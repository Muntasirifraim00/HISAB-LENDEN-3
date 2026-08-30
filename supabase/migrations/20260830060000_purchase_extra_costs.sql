-- =====================================================================
-- ক্রয়/বিক্রয়ে অতিরিক্ত খরচ — গাড়ি ভাড়া, লেবার, লোড-আনলোড…
-- =====================================================================
-- এতদিন খরচের সারি শুধু "খরচ" ধরনের এন্ট্রিতেই লেখা যেত, আর সেগুলো
-- টাকার কোনো হিসাবেই ঢুকত না — পুঁজি কমত না, ক্রয়মূল্যে যোগ হতো না।
-- ফলে ১০,০০০ টাকার মাল আনতে ৫০০ টাকা গাড়ি ভাড়া লাগলে সেই ৫০০ কোথাও
-- ধরা পড়ত না।
--
-- এখনকার নিয়ম:
--
--   ক্রয়ে   → অতিরিক্ত খরচ পণ্যের দরে অনুপাত অনুযায়ী ভাগ হয়। ১০,০০০-এ
--             ১০০ পিস + ৫০০ ভাড়া হলে প্রতি পিসের ক্রয়মূল্য ১০৫। বিক্রির
--             সময় FIFO এই দরই ধরে, তাই লাভের অঙ্ক সত্যিকারের হয়।
--   বিক্রয়ে → পণ্যের দরে যোগ হয় না (মাল তো চলে যাচ্ছে), সরাসরি লাভ
--             থেকে বাদ যায়।
--   পুঁজি   → দুই ক্ষেত্রেই টাকাটা পুঁজি থেকে কমে।
--   পাওনা   → বিলের অঙ্ক ১০,০০০-ই থাকে। ৫০০ তো গাড়িওয়ালাকে দেওয়া,
--             বিক্রেতাকে নয় — তাই পার্টির খাতায় মেশানো হয় না।
-- =====================================================================

-- ---------------------------------------------------------------------
-- ১. নতুন ঘরগুলো
-- ---------------------------------------------------------------------

-- এই চালানে মোট কত অতিরিক্ত খরচ হয়েছে
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS extra_cost NUMERIC(14, 2) NOT NULL DEFAULT 0;

-- সারির দাম + তার ভাগে পড়া অতিরিক্ত খরচ = গুদামে পৌঁছানো পর্যন্ত মোট।
-- অগ্রিম ক্রয়ে মাল পরে আসে, তখন hb_receive_goods এই ঘরটাই ব্যবহার করে —
-- তাই খরচের ভাগটা এখানে জমা রাখা হয়, প্রতিবার নতুন করে হিসাব হয় না।
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS landed_total NUMERIC(14, 2);

-- কাকে টাকাটা দেওয়া হলো (গাড়িচালক, কুলি সর্দার…)
ALTER TABLE public.invoice_expenses
  ADD COLUMN IF NOT EXISTS paid_to TEXT;

-- পুরনো সারিগুলোয় অতিরিক্ত খরচ ছিল না, তাই দাম আর মোট এক
UPDATE public.invoice_items SET landed_total = line_total WHERE landed_total IS NULL;

-- ---------------------------------------------------------------------
-- ২. পুঁজির ট্রিগার — অতিরিক্ত খরচও ধরবে
-- ---------------------------------------------------------------------
-- আগে শুধু paid_amount বদলালে কাজ করত। এখন extra_cost বদলালেও কাজ করে।
-- hb_create_invoice প্রথমে চালান বসায় (extra_cost = ০), তারপর শেষে
-- extra_cost বসায় — সেই UPDATE-টাই এখানে ধরা পড়ে।
CREATE OR REPLACE FUNCTION public.hb_capital_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid   NUMERIC;
  v_extra  NUMERIC;
  v_change NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.business_capital) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_paid  := NEW.paid_amount;
    v_extra := NEW.extra_cost;
  ELSE
    v_paid  := NEW.paid_amount - OLD.paid_amount;
    v_extra := NEW.extra_cost  - OLD.extra_cost;
  END IF;

  -- বিক্রয়ে টাকা আসে, ক্রয় ও খরচে বেরিয়ে যায়
  IF NEW.type = 'sale' THEN
    v_change := v_paid;
  ELSE
    v_change := -v_paid;
  END IF;

  -- অতিরিক্ত খরচ সব ক্ষেত্রেই বেরিয়ে যাওয়া টাকা
  v_change := v_change - v_extra;

  IF v_change <> 0 THEN
    PERFORM set_config('hb.sys', 'on', true);
    UPDATE public.business_capital
       SET current_balance = current_balance + v_change,
           updated_at = now()
     WHERE 1=1;
    PERFORM set_config('hb.sys', 'off', true);
  END IF;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ---------------------------------------------------------------------
-- ৩. চালান তৈরি — সব ধরনে খরচ নেয়, ক্রয়ে দরে ভাগ করে
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hb_create_invoice(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv       public.invoices;
  v_actor     TEXT := public.hb_actor_name();
  v_type      public.hb_invoice_type := (p ->> 'type')::public.hb_invoice_type;
  v_date      DATE := (p ->> 'invoice_date')::DATE;
  v_total     NUMERIC := round(coalesce((p ->> 'total_amount')::NUMERIC, 0), 2);
  v_nothing   BOOLEAN := coalesce((p ->> 'nothing_paid')::BOOLEAN, false);
  v_paid_raw  NUMERIC := nullif(p ->> 'paid_amount', '')::NUMERIC;
  v_paid      NUMERIC;
  v_advance   BOOLEAN := coalesce((p ->> 'goods_pending')::BOOLEAN, false);
  v_goods     public.hb_goods_status := 'n_a';
  v_warehouse UUID := nullif(p ->> 'warehouse_id', '')::UUID;
  v_customer  UUID := nullif(p ->> 'customer_id', '')::UUID;
  v_supplier  UUID := nullif(p ->> 'supplier_id', '')::UUID;
  v_party     TEXT := nullif(btrim(p ->> 'party_name'), '');
  v_item      JSONB;
  v_exp       JSONB;
  v_pid       UUID;
  v_qty       NUMERIC;
  v_cost_ref  NUMERIC;
  v_fifo      NUMERIC[];
  v_cogs      NUMERIC := 0;
  v_short     BOOLEAN := false;
  v_item_id   UUID;
  v_unit      TEXT;
  v_line      NUMERIC;
  -- অতিরিক্ত খরচ ভাগ করার জন্য
  v_extra     NUMERIC := 0;
  v_items_tot NUMERIC := 0;
  v_item_cnt  INT := 0;
  v_idx       INT := 0;
  v_alloc     NUMERIC := 0;
  v_share     NUMERIC;
  v_landed    NUMERIC;
BEGIN
  -- ---- সেভ করার আগে পরীক্ষা ----
  IF v_date > current_date THEN
    RAISE EXCEPTION 'ভবিষ্যতের তারিখে হিসাব লেখা যায় না।' USING ERRCODE = 'check_violation';
  END IF;

  IF nullif(p ->> 'image_url', '') IS NULL
     AND coalesce(length(btrim(p ->> 'no_image_reason')), 0) < 3 THEN
    RAISE EXCEPTION 'ছবি না থাকলে কারণ লিখতে হবে।' USING ERRCODE = 'check_violation';
  END IF;

  IF v_warehouse IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = v_warehouse AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত গুদামটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_type = 'sale' AND v_customer IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত গ্রাহকটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
    SELECT name INTO v_party FROM public.customers WHERE id = v_customer;
  END IF;

  IF v_type = 'purchase' AND v_supplier IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = v_supplier AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত বিক্রেতাটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
    SELECT name INTO v_party FROM public.suppliers WHERE id = v_supplier;
  END IF;

  -- ---- অতিরিক্ত খরচের মোট ----
  SELECT coalesce(sum(round(coalesce((e ->> 'amount')::NUMERIC, 0), 2)), 0)
    INTO v_extra
    FROM jsonb_array_elements(coalesce(p -> 'expenses', '[]'::jsonb)) e
   WHERE round(coalesce((e ->> 'amount')::NUMERIC, 0), 2) > 0;

  -- ---- পণ্যের সারির মোট — খরচ কোন অনুপাতে ভাগ হবে তার ভিত্তি ----
  -- নিচের লুপ qty <= 0 সারিগুলো বাদ দেয়, তাই এখানেও একই শর্ত
  SELECT coalesce(sum(round(coalesce((it ->> 'line_total')::NUMERIC,
                     coalesce((it ->> 'qty')::NUMERIC, 0)
                     * coalesce((it ->> 'unit_price')::NUMERIC, 0)), 2)), 0),
         count(*)
    INTO v_items_tot, v_item_cnt
    FROM jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) it
   WHERE round(coalesce((it ->> 'qty')::NUMERIC, 0), 3) > 0;

  -- ---- পরিশোধের নিয়ম ----
  IF v_nothing THEN
    v_paid := 0;
  ELSIF v_paid_raw IS NULL OR v_paid_raw = 0 THEN
    v_paid := v_total;
  ELSE
    v_paid := LEAST(round(v_paid_raw, 2), v_total);
  END IF;

  IF v_type = 'purchase' THEN
    v_goods := CASE WHEN v_advance THEN 'pending' ELSE 'received' END;
  END IF;

  INSERT INTO public.invoices (
    type, invoice_date, memo_no, party_name, details, total_amount, paid_amount,
    payment_method, image_url, no_image_reason, goods_status, warehouse_id,
    customer_id, supplier_id, created_by, created_by_name
  ) VALUES (
    v_type, v_date,
    nullif(btrim(p ->> 'memo_no'), ''),
    coalesce(v_party, 'পার্টির নাম নেই'),
    nullif(btrim(p ->> 'details'), ''),
    v_total, v_paid,
    coalesce(nullif(p ->> 'payment_method', ''), 'cash')::public.hb_payment_method,
    nullif(p ->> 'image_url', ''),
    nullif(btrim(p ->> 'no_image_reason'), ''),
    v_goods, v_warehouse, v_customer, v_supplier, auth.uid(), v_actor
  ) RETURNING * INTO v_inv;

  -- ---- অতিরিক্ত খরচের সারি ----
  FOR v_exp IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'expenses', '[]'::jsonb)) LOOP
    CONTINUE WHEN round(coalesce((v_exp ->> 'amount')::NUMERIC, 0), 2) <= 0;

    INSERT INTO public.invoice_expenses (invoice_id, head, amount, note, paid_to)
    VALUES (
      v_inv.id,
      coalesce(nullif(btrim(v_exp ->> 'head'), ''), 'অন্যান্য'),
      round(coalesce((v_exp ->> 'amount')::NUMERIC, 0), 2),
      nullif(btrim(v_exp ->> 'note'), ''),
      nullif(btrim(v_exp ->> 'paid_to'), '')
    );
  END LOOP;

  -- ---- পণ্যের সারি + স্টকের প্রভাব ----
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) LOOP
    v_pid := nullif(v_item ->> 'product_id', '')::UUID;
    v_qty := round(coalesce((v_item ->> 'qty')::NUMERIC, 0), 3);
    CONTINUE WHEN v_qty <= 0;

    v_line := round(coalesce((v_item ->> 'line_total')::NUMERIC,
                             v_qty * coalesce((v_item ->> 'unit_price')::NUMERIC, 0)), 2);

    -- খরচের ভাগ — কেবল ক্রয়ে, দামের অনুপাতে।
    -- শেষ সারিতে বাকিটুকু পুরোটা দেওয়া হয়, নইলে গোল করতে গিয়ে
    -- দু-এক পয়সা হারিয়ে যেত।
    v_idx := v_idx + 1;
    IF v_type = 'purchase' AND v_extra > 0 AND v_items_tot > 0 THEN
      IF v_idx = v_item_cnt THEN
        v_share := v_extra - v_alloc;
      ELSE
        v_share := round(v_extra * v_line / v_items_tot, 2);
        v_alloc := v_alloc + v_share;
      END IF;
    ELSE
      v_share := 0;
    END IF;
    v_landed := v_line + v_share;

    SELECT coalesce(pr.cost_price, 0), coalesce(pr.unit, 'pcs')
      INTO v_cost_ref, v_unit
      FROM public.products pr WHERE pr.id = v_pid;
    v_cost_ref := coalesce(v_cost_ref, 0);
    v_unit := coalesce(v_unit, 'pcs');

    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, qty, unit, unit_price, cost_price,
      line_total, landed_total
    ) VALUES (
      v_inv.id, v_pid,
      coalesce(nullif(btrim(v_item ->> 'product_name'), ''), 'পণ্য'),
      v_qty, v_unit,
      round(coalesce((v_item ->> 'unit_price')::NUMERIC, 0), 2),
      v_cost_ref, v_line, v_landed
    ) RETURNING id INTO v_item_id;

    IF v_pid IS NULL THEN CONTINUE; END IF;

    PERFORM set_config('hb.sys', 'on', true);

    IF v_type = 'purchase' AND NOT v_advance THEN
      -- লটের দর গুদামে পৌঁছানো পর্যন্ত মোট খরচ ধরে
      INSERT INTO public.stock_lots (product_id, invoice_id, lot_date, qty_in, qty_remaining, unit_cost, reason)
      VALUES (v_pid, v_inv.id, v_date, v_qty, v_qty,
              CASE WHEN v_qty > 0 THEN round(v_landed / v_qty, 4) ELSE 0 END, 'purchase');

      INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, created_by_name)
      VALUES (v_pid, v_inv.id, v_date, v_qty,
              CASE WHEN v_qty > 0 THEN round(v_landed / v_qty, 4) ELSE 0 END, 'purchase', v_actor);

      UPDATE public.invoice_items SET received_qty = v_qty WHERE id = v_item_id;

    ELSIF v_type = 'sale' THEN
      v_fifo := public.hb_consume_fifo(v_pid, v_qty, v_cost_ref);
      v_cogs := v_cogs + v_fifo[1];

      IF v_fifo[2] > 0 THEN
        v_short := true;
      END IF;

      UPDATE public.invoice_items SET line_cogs = v_fifo[1] WHERE id = v_item_id;

      INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, note, created_by_name)
      VALUES (v_pid, v_inv.id, v_date, -v_qty,
              CASE WHEN v_qty > 0 THEN round(v_fifo[1] / v_qty, 4) ELSE 0 END, 'sale',
              CASE WHEN v_fifo[2] > 0 THEN 'স্টকে পর্যাপ্ত মাল ছিল না' ELSE NULL END,
              v_actor);
    END IF;

    PERFORM set_config('hb.sys', 'off', true);
  END LOOP;

  -- ---- লাভ ও অতিরিক্ত খরচ ----
  -- বিক্রয়ে লাভ = বিল − FIFO ক্রয়মূল্য − ঐ বিক্রয়ের অতিরিক্ত খরচ।
  -- extra_cost বসার সাথে সাথে hb_capital_update ট্রিগার পুঁজি থেকে
  -- টাকাটা কমিয়ে দেয়।
  PERFORM set_config('hb.sys', 'on', true);
  UPDATE public.invoices
     SET cogs            = CASE WHEN v_type = 'sale' THEN round(v_cogs, 2) ELSE 0 END,
         profit          = CASE WHEN v_type = 'sale' THEN round(v_total - v_cogs - v_extra, 2) ELSE 0 END,
         stock_shortfall = v_short,
         extra_cost      = v_extra
   WHERE id = v_inv.id
   RETURNING * INTO v_inv;
  PERFORM set_config('hb.sys', 'off', true);

  RETURN v_inv;
END;
$$;

-- ---------------------------------------------------------------------
-- ৪. মাল বুঝে পাওয়া — অগ্রিম ক্রয়ে লট তৈরি হয় এখানে
-- ---------------------------------------------------------------------
-- আগে দর আসত line_total থেকে। এখন landed_total থেকে, যাতে অগ্রিম
-- ক্রয়েও গাড়ি ভাড়াটা পণ্যের দরে থাকে।
CREATE OR REPLACE FUNCTION public.hb_receive_goods(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv     public.invoices;
  v_actor   TEXT := public.hb_actor_name();
  v_on      DATE := coalesce((p ->> 'received_on')::DATE, current_date);
  v_line    JSONB;
  v_lines   JSONB := coalesce(p -> 'lines', '[]'::jsonb);
  v_item    public.invoice_items;
  v_qty     NUMERIC;
  v_unit_c  NUMERIC;
  v_base    NUMERIC;
  v_pending NUMERIC;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = (p ->> 'invoice_id')::UUID FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'হিসাবটি পাওয়া যায়নি।' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_inv.type <> 'purchase' THEN
    RAISE EXCEPTION 'শুধু ক্রয়ের ক্ষেত্রে মাল বুঝে পাওয়ার হিসাব হয়।' USING ERRCODE = 'check_violation';
  END IF;
  IF v_inv.goods_status = 'received' THEN
    RAISE EXCEPTION 'এই চালানের সব মাল আগেই বুঝে পাওয়া হয়েছে।' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('hb.sys', 'on', true);

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    SELECT * INTO v_item FROM public.invoice_items
     WHERE id = (v_line ->> 'item_id')::UUID AND invoice_id = v_inv.id;
    CONTINUE WHEN NOT FOUND OR v_item.product_id IS NULL;

    v_qty := LEAST(
      round(coalesce((v_line ->> 'qty')::NUMERIC, 0), 3),
      v_item.qty - v_item.received_qty
    );
    CONTINUE WHEN v_qty <= 0;

    -- গুদামে পৌঁছানো পর্যন্ত মোট খরচ; পুরনো সারিতে landed_total নেই
    v_base := coalesce(v_item.landed_total, v_item.line_total);
    v_unit_c := CASE WHEN v_item.qty > 0 THEN round(v_base / v_item.qty, 4) ELSE 0 END;

    INSERT INTO public.stock_lots (product_id, invoice_id, lot_date, qty_in, qty_remaining, unit_cost, reason)
    VALUES (v_item.product_id, v_inv.id, v_on, v_qty, v_qty, v_unit_c, 'receipt');

    INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, note, created_by_name)
    VALUES (v_item.product_id, v_inv.id, v_on, v_qty, v_unit_c, 'receipt', 'মাল বুঝে পাওয়া', v_actor);

    UPDATE public.invoice_items SET received_qty = received_qty + v_qty WHERE id = v_item.id;
  END LOOP;

  INSERT INTO public.invoice_receipts (invoice_id, received_on, lines, note, created_by, created_by_name)
  VALUES (v_inv.id, v_on, v_lines, nullif(btrim(p ->> 'note'), ''), auth.uid(), v_actor);

  SELECT coalesce(sum(qty - received_qty), 0) INTO v_pending
    FROM public.invoice_items WHERE invoice_id = v_inv.id;

  UPDATE public.invoices
     SET goods_status = CASE
           WHEN v_pending <= 0 THEN 'received'::public.hb_goods_status
           WHEN EXISTS (SELECT 1 FROM public.invoice_items
                         WHERE invoice_id = v_inv.id AND received_qty > 0)
             THEN 'partial'::public.hb_goods_status
           ELSE 'pending'::public.hb_goods_status END
   WHERE id = v_inv.id
   RETURNING * INTO v_inv;

  PERFORM set_config('hb.sys', 'off', true);
  RETURN v_inv;
END;
$$;

-- ---------------------------------------------------------------------
-- ৫. বাতিল / সংশোধনী — অতিরিক্ত খরচও ফেরত আসবে
-- ---------------------------------------------------------------------
-- সংশোধনীতে extra_cost ঋণাত্মক বসে, ফলে ট্রিগার পুঁজিতে টাকাটা ফিরিয়ে
-- দেয় — cogs ও profit যেভাবে ঋণাত্মক বসে, ঠিক সেভাবেই।
CREATE OR REPLACE FUNCTION public.hb_reverse_invoice(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src     public.invoices;
  v_new     public.invoices;
  v_actor   TEXT := public.hb_actor_name();
  v_item    public.invoice_items;
  v_exp     public.invoice_expenses;
  v_date    DATE := coalesce((p ->> 'invoice_date')::DATE, current_date);
  v_unit_c  NUMERIC;
  v_back    NUMERIC;
  v_base    NUMERIC;
  v_new_item UUID;
BEGIN
  SELECT * INTO v_src FROM public.invoices WHERE id = (p ->> 'invoice_id')::UUID FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'হিসাবটি পাওয়া যায়নি।' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_src.is_reversal THEN
    RAISE EXCEPTION 'সংশোধনীকে আবার সংশোধন করা যায় না।' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE reverses_invoice_id = v_src.id) THEN
    RAISE EXCEPTION 'এই হিসাবটি আগেই সংশোধন করা হয়েছে।' USING ERRCODE = 'check_violation';
  END IF;
  IF v_date > current_date THEN
    RAISE EXCEPTION 'ভবিষ্যতের তারিখে সংশোধনী দেওয়া যায় না।' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.invoices (
    type, invoice_date, party_name, details, total_amount, paid_amount, payment_method,
    image_url, no_image_reason, goods_status, is_reversal, reverses_invoice_id,
    customer_id, supplier_id, created_by, created_by_name
  ) VALUES (
    v_src.type, v_date, v_src.party_name,
    coalesce(nullif(btrim(p ->> 'reason'), ''), 'সংশোধনী'),
    v_src.total_amount, v_src.paid_amount, v_src.payment_method,
    v_src.image_url,
    CASE WHEN v_src.image_url IS NULL THEN 'মূল এন্ট্রির সংশোধনী' ELSE NULL END,
    'n_a', true, v_src.id, v_src.customer_id, v_src.supplier_id, auth.uid(), v_actor
  ) RETURNING * INTO v_new;

  PERFORM set_config('hb.sys', 'on', true);

  -- মূল এন্ট্রির খরচের খাত অনুলিপি হয়
  FOR v_exp IN SELECT * FROM public.invoice_expenses WHERE invoice_id = v_src.id LOOP
    INSERT INTO public.invoice_expenses (invoice_id, head, amount, note, paid_to)
    VALUES (v_new.id, v_exp.head, v_exp.amount, 'সংশোধনী', v_exp.paid_to);
  END LOOP;

  -- মূল এন্ট্রির পণ্যের সারি অনুলিপি হয়, স্টকে উল্টো প্রভাব পড়ে
  FOR v_item IN SELECT * FROM public.invoice_items WHERE invoice_id = v_src.id LOOP
    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, qty, unit, unit_price, cost_price,
      line_total, landed_total
    ) VALUES (
      v_new.id, v_item.product_id, v_item.product_name, v_item.qty, v_item.unit,
      v_item.unit_price, v_item.cost_price, v_item.line_total,
      coalesce(v_item.landed_total, v_item.line_total)
    ) RETURNING id INTO v_new_item;

    CONTINUE WHEN v_item.product_id IS NULL;

    IF v_src.type = 'sale' THEN
      v_unit_c := CASE WHEN v_item.qty > 0 THEN round(v_item.line_cogs / v_item.qty, 4) ELSE 0 END;

      INSERT INTO public.stock_lots (product_id, invoice_id, lot_date, qty_in, qty_remaining, unit_cost, reason)
      VALUES (v_item.product_id, v_new.id, v_date, v_item.qty, v_item.qty, v_unit_c, 'reversal');

      INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, note, created_by_name)
      VALUES (v_item.product_id, v_new.id, v_date, v_item.qty, v_unit_c, 'reversal',
              'বিক্রয় বাতিল', v_actor);

      UPDATE public.invoice_items SET line_cogs = -v_item.line_cogs WHERE id = v_new_item;

    ELSIF v_src.type = 'purchase' THEN
      v_back := v_item.received_qty;
      CONTINUE WHEN v_back <= 0;

      PERFORM public.hb_return_purchase(
        v_item.product_id, v_back, v_src.id, coalesce(v_item.cost_price, 0));

      v_base := coalesce(v_item.landed_total, v_item.line_total);
      INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, note, created_by_name)
      VALUES (v_item.product_id, v_new.id, v_date, -v_back,
              CASE WHEN v_item.qty > 0 THEN round(v_base / v_item.qty, 4) ELSE 0 END,
              'reversal', 'ক্রয় বাতিল', v_actor);
    END IF;
  END LOOP;

  UPDATE public.invoices
     SET cogs       = CASE WHEN v_src.type = 'sale' THEN -v_src.cogs ELSE 0 END,
         profit     = CASE WHEN v_src.type = 'sale' THEN -v_src.profit ELSE 0 END,
         extra_cost = -v_src.extra_cost
   WHERE id = v_new.id RETURNING * INTO v_new;

  UPDATE public.invoices SET reversed_at = now() WHERE id = v_src.id;

  PERFORM set_config('hb.sys', 'off', true);
  RETURN v_new;
END;
$$;
