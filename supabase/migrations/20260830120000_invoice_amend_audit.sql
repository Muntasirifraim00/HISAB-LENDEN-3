-- =====================================================================
-- সংশোধন ও তার নজরদারি
-- =====================================================================
-- এতদিন একটা এন্ট্রিতে শুধু "বিবরণ" বদলানো যেত। টাকা ভুল হলে "বাতিল /
-- সংশোধনী" দিয়ে উল্টো এন্ট্রি দেওয়া যেত, কিন্তু সঠিক অঙ্কের নতুন
-- এন্ট্রিটা হাতে আবার লিখতে হতো — আর দুটোর মধ্যে কোনো যোগসূত্র থাকত না।
--
-- এখন একটাই কাজ: "সংশোধন করুন"। ভেতরে তিন ধাপে হয় —
--
--   ১. মূল এন্ট্রি বাতিল হয় (স্টক ও পুঁজি উল্টে যায়)
--   ২. সংশোধিত অঙ্কে নতুন এন্ট্রি হয় (স্টক ও পুঁজি নতুন করে বসে)
--   ৩. দুটো জোড়া লাগে, আর কী থেকে কী হলো সব লেখা থাকে
--
-- সরাসরি টাকার ঘরটা বদলে দেওয়া হয় না — তাহলে মাল তো ইতিমধ্যে FIFO
-- দিয়ে কাটা হয়ে গেছে, পুঁজিও সরে গেছে; শুধু সংখ্যাটা পাল্টালে বাকি সব
-- মিথ্যা হয়ে যেত।
--
-- বাতিলের এন্ট্রিটা মূল এন্ট্রির *একই তারিখে* বসে, যাতে ঐ দিনের হিসাব
-- মিলে যায়: মূল (+X) + বাতিল (−X) + সংশোধিত (+Y) = Y। সংশোধন কখন হলো
-- সেটা আলাদা করে created_at-এ থাকে।
--
-- তারিখ ও ধরন বদলানো যায় না — আগের মতোই।
-- =====================================================================

-- ---------------------------------------------------------------------
-- ১. সংশোধিত এন্ট্রি কোনটার বদলে এল
-- ---------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amends_invoice_id UUID REFERENCES public.invoices(id);

CREATE INDEX IF NOT EXISTS invoices_amends_idx
  ON public.invoices (amends_invoice_id) WHERE amends_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- ২. নজরদারির খাতা — কে, কখন, কোন ঘর, আগে কী, পরে কী
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- যে এন্ট্রিতে হাত পড়ল
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  -- সংশোধনে যে নতুন এন্ট্রি তৈরি হলো
  new_invoice_id  UUID REFERENCES public.invoices(id) ON DELETE RESTRICT,
  -- 'edit' = শুধু বিবরণ, 'amend' = অঙ্কসহ সংশোধন
  action          TEXT NOT NULL,
  -- কোন ঘর বদলাল। NULL মানে এটা সংশোধনের শিরোনামের সারি
  field           TEXT,
  old_value       TEXT,
  new_value       TEXT,
  reason          TEXT,
  actor           UUID,
  actor_name      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_audit_invoice_idx ON public.invoice_audit (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_audit_when_idx ON public.invoice_audit (created_at DESC);

-- নজরদারির সারি মোছা বা বদলানো যাবে না — নইলে নজরদারির মানেই থাকে না
DROP TRIGGER IF EXISTS hb_guard ON public.invoice_audit;
CREATE TRIGGER hb_guard BEFORE UPDATE OR DELETE ON public.invoice_audit
  FOR EACH ROW EXECUTE FUNCTION public.hb_immutable_guard();

ALTER TABLE public.invoice_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hb read" ON public.invoice_audit;
CREATE POLICY "hb read" ON public.invoice_audit FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT SELECT ON public.invoice_audit TO authenticated;

-- ---------------------------------------------------------------------
-- ৩. সংশোধন — বাতিল + নতুন এন্ট্রি + লগ, সব এক ট্রানজেকশনে
-- ---------------------------------------------------------------------
-- যা যা বদলানো যায়: total_amount, paid_amount, party_name, memo_no,
-- details, payment_method, customer_id, supplier_id, warehouse_id,
-- items, expenses। কোনোটা না দিলে মূল এন্ট্রির মানটাই থাকে।
--
-- যা বদলানো যায় না: তারিখ ও ধরন।
CREATE OR REPLACE FUNCTION public.hb_amend_invoice(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src     public.invoices;
  v_new     public.invoices;
  v_actor   TEXT := public.hb_actor_name();
  v_reason  TEXT := nullif(btrim(p ->> 'reason'), '');
  v_items   JSONB;
  v_exps    JSONB;
  v_paid    NUMERIC;
  v_payload JSONB;
  v_prev    TEXT;
BEGIN
  SELECT * INTO v_src FROM public.invoices
   WHERE id = (p ->> 'invoice_id')::UUID FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'হিসাবটি পাওয়া যায়নি।' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_src.is_reversal THEN
    RAISE EXCEPTION 'সংশোধনী এন্ট্রি নিজে সংশোধন করা যায় না।' USING ERRCODE = 'check_violation';
  END IF;
  IF v_src.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'এই এন্ট্রিটি আগেই সংশোধন বা বাতিল করা হয়েছে।' USING ERRCODE = 'check_violation';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'সংশোধনের কারণ লিখতে হবে।' USING ERRCODE = 'check_violation';
  END IF;

  -- ---- মূল এন্ট্রির সারিগুলো আগেই তুলে রাখি ----
  -- নতুন কিছু না দিলে এগুলোই আবার বসবে
  IF p ? 'items' THEN
    v_items := p -> 'items';
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'product_id',   ii.product_id,
             'product_name', ii.product_name,
             'qty',          ii.qty,
             'unit_price',   ii.unit_price,
             'line_total',   ii.line_total)), '[]'::jsonb)
      INTO v_items
      FROM public.invoice_items ii WHERE ii.invoice_id = v_src.id;
  END IF;

  IF p ? 'expenses' THEN
    v_exps := p -> 'expenses';
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'head',    e.head,
             'amount',  e.amount,
             'note',    e.note,
             'paid_to', e.paid_to)), '[]'::jsonb)
      INTO v_exps
      FROM public.invoice_expenses e WHERE e.invoice_id = v_src.id;
  END IF;

  -- ---- ধাপ ১: মূল এন্ট্রি বাতিল, একই তারিখে ----
  PERFORM public.hb_reverse_invoice(jsonb_build_object(
    'invoice_id',   v_src.id,
    'invoice_date', v_src.invoice_date,
    'reason',       'সংশোধনের জন্য বাতিল — ' || v_reason
  ));

  -- ---- ধাপ ২: সংশোধিত অঙ্কে নতুন এন্ট্রি ----
  -- পরিশোধ ০ হলে hb_create_invoice-কে স্পষ্ট বলতে হয়, নইলে সে
  -- "সব দেওয়া হয়ে গেছে" ধরে নেয়
  v_paid := coalesce(nullif(p ->> 'paid_amount', '')::NUMERIC, v_src.paid_amount);

  v_payload := jsonb_build_object(
    'type',            v_src.type::text,
    'invoice_date',    v_src.invoice_date::text,   -- তারিখ বদলায় না
    'memo_no',         coalesce(p ->> 'memo_no', v_src.memo_no),
    'party_name',      coalesce(p ->> 'party_name', v_src.party_name),
    'customer_id',     coalesce(p ->> 'customer_id', v_src.customer_id::text),
    'supplier_id',     coalesce(p ->> 'supplier_id', v_src.supplier_id::text),
    'warehouse_id',    coalesce(p ->> 'warehouse_id', v_src.warehouse_id::text),
    'details',         coalesce(p ->> 'details', v_src.details),
    'total_amount',    coalesce(nullif(p ->> 'total_amount', '')::NUMERIC, v_src.total_amount),
    'paid_amount',     v_paid,
    'nothing_paid',    (v_paid = 0),
    'payment_method',  coalesce(p ->> 'payment_method', v_src.payment_method::text),
    'image_url',       v_src.image_url,
    'no_image_reason', coalesce(v_src.no_image_reason, 'সংশোধিত এন্ট্রি'),
    'goods_pending',   (v_src.goods_status = 'pending'),
    'items',           v_items,
    'expenses',        v_exps
  );

  SELECT * INTO v_new FROM public.hb_create_invoice(v_payload);

  -- ---- ধাপ ৩: দুটো জোড়া লাগানো ----
  v_prev := coalesce(current_setting('hb.sys', true), '');
  PERFORM set_config('hb.sys', 'on', true);
  UPDATE public.invoices SET amends_invoice_id = v_src.id WHERE id = v_new.id;
  PERFORM set_config('hb.sys', v_prev, true);

  SELECT * INTO v_new FROM public.invoices WHERE id = v_new.id;

  -- ---- নজরদারির খাতায় লেখা ----
  -- শিরোনামের সারি: কে, কখন, কেন
  INSERT INTO public.invoice_audit (
    invoice_id, new_invoice_id, action, reason, actor, actor_name
  ) VALUES (v_src.id, v_new.id, 'amend', v_reason, auth.uid(), v_actor);

  -- যে ঘরগুলো সত্যিই বদলেছে, কেবল সেগুলো
  INSERT INTO public.invoice_audit (
    invoice_id, new_invoice_id, action, field, old_value, new_value,
    reason, actor, actor_name
  )
  SELECT v_src.id, v_new.id, 'amend', f.field, f.old_v, f.new_v,
         v_reason, auth.uid(), v_actor
    FROM (VALUES
      ('মোট অঙ্ক',       v_src.total_amount::text,   v_new.total_amount::text),
      ('পরিশোধ',         v_src.paid_amount::text,    v_new.paid_amount::text),
      ('পার্টির নাম',    v_src.party_name,           v_new.party_name),
      ('মেমো নং',        v_src.memo_no,              v_new.memo_no),
      ('বিবরণ',          v_src.details,              v_new.details),
      ('পরিশোধের ধরন',   v_src.payment_method::text, v_new.payment_method::text),
      ('অতিরিক্ত খরচ',   v_src.extra_cost::text,     v_new.extra_cost::text)
    ) AS f(field, old_v, new_v)
   WHERE coalesce(f.old_v, '') IS DISTINCT FROM coalesce(f.new_v, '');

  RETURN v_new;
END;
$$;

-- ---------------------------------------------------------------------
-- ৪. বিবরণ সম্পাদনাও একই খাতায় উঠবে
-- ---------------------------------------------------------------------
-- আগের invoice_detail_edits টেবিলটা রয়ে গেল (ইনভয়েস পাতায় ওটাই
-- দেখানো হয়), কিন্তু সব বদল এক জায়গায় দেখতে চাইলে invoice_audit-ই
-- একমাত্র উৎস — তাই এখানেও একটা সারি ওঠে।
CREATE OR REPLACE FUNCTION public.hb_edit_details(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   public.invoices;
  v_new   TEXT := nullif(btrim(p ->> 'details'), '');
  v_actor TEXT := public.hb_actor_name();
  v_old   TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = (p ->> 'invoice_id')::UUID FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'হিসাবটি পাওয়া যায়নি।' USING ERRCODE = 'no_data_found';
  END IF;
  IF coalesce(v_inv.details, '') = coalesce(v_new, '') THEN
    RETURN v_inv;
  END IF;

  v_old := v_inv.details;

  INSERT INTO public.invoice_detail_edits (
    invoice_id, revision_no, old_details, new_details, edited_by, edited_by_name
  ) VALUES (
    v_inv.id, v_inv.detail_revision + 1, v_old, v_new, auth.uid(), v_actor
  );

  INSERT INTO public.invoice_audit (
    invoice_id, action, field, old_value, new_value, actor, actor_name
  ) VALUES (
    v_inv.id, 'edit', 'বিবরণ', v_old, v_new, auth.uid(), v_actor
  );

  PERFORM set_config('hb.sys', 'on', true);
  UPDATE public.invoices
     SET details = v_new, detail_revision = detail_revision + 1
   WHERE id = v_inv.id RETURNING * INTO v_inv;
  PERFORM set_config('hb.sys', 'off', true);

  RETURN v_inv;
END;
$$;

-- ---------------------------------------------------------------------
-- ৫. অনুমতি — লগইন করা ব্যবহারকারীই কেবল
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.hb_amend_invoice(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_amend_invoice(jsonb) TO authenticated;

REVOKE ALL ON TABLE public.invoice_audit FROM anon;

-- ---------------------------------------------------------------------
-- ৬. যাচাই
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.invoice_audit', 'SELECT') THEN
    RAISE EXCEPTION 'anon নজরদারির খাতা পড়তে পারছে';
  END IF;
  IF has_function_privilege('anon', 'public.hb_amend_invoice(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon সংশোধন করতে পারছে';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.hb_amend_invoice(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'লগইন করা ব্যবহারকারী সংশোধন করতে পারছে না';
  END IF;
END $$;
