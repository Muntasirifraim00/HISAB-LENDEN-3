-- =====================================================================
-- পুঁজি ও গুদাম ব্যবস্থাপনার ফাংশন
-- =====================================================================

-- १. ব্যবসায়িক পুঁজি শুরু করা (প্রথমবার)
CREATE OR REPLACE FUNCTION public.hb_init_capital(p_amount NUMERIC)
RETURNS public.business_capital
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap public.business_capital;
BEGIN
  -- ইতিমধ্যে আছে কিনা দেখো
  SELECT * INTO v_cap FROM public.business_capital LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ব্যবসায়িক পুঁজি ইতিমধ্যে সেট করা হয়েছে।'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'পুঁজির অঙ্ক শূন্যের বেশি হতে হবে।'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('hb.sys', 'on', true);

  INSERT INTO public.business_capital (
    opening_balance, current_balance, total_investment,
    created_by, created_by_name
  ) VALUES (
    round(p_amount, 2), round(p_amount, 2), 0,
    auth.uid(), public.hb_actor_name()
  ) RETURNING * INTO v_cap;

  PERFORM set_config('hb.sys', 'off', true);
  RETURN v_cap;
END;
$$;

-- २. পুঁজি যোগ করা (নতুন অর্থ সংযোজন)
CREATE OR REPLACE FUNCTION public.hb_inject_capital(p_amount NUMERIC, p_note TEXT DEFAULT NULL)
RETURNS public.business_capital
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap   public.business_capital;
  v_actor TEXT := public.hb_actor_name();
BEGIN
  SELECT * INTO v_cap FROM public.business_capital LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'প্রথমে পুঁজি সেট করুন।'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'যুক্ত করার অঙ্ক শূন্যের বেশি হতে হবে।'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('hb.sys', 'on', true);

  -- পুঁজি যোগের ইতিহাস
  INSERT INTO public.capital_injections (
    amount, injected_on, note, created_by, created_by_name
  ) VALUES (
    round(p_amount, 2), current_date, nullif(btrim(p_note), ''),
    auth.uid(), v_actor
  );

  -- পুঁজি আপডেট
  UPDATE public.business_capital
     SET current_balance = current_balance + round(p_amount, 2),
         total_investment = total_investment + round(p_amount, 2),
         updated_at = now()
  WHERE 1=1  -- সব রেকর্ড আপডেট
  RETURNING * INTO v_cap;

  PERFORM set_config('hb.sys', 'off', true);
  RETURN v_cap;
END;
$$;

-- ३. বিক্রয় ও ক্রয় পরবর্তী পুঁজি আপডেট
CREATE OR REPLACE FUNCTION public.hb_update_capital_after_transaction(p_invoice_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv    public.invoices;
  v_change NUMERIC;
  v_cap    public.business_capital;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cap FROM public.business_capital LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM set_config('hb.sys', 'on', true);

  -- ক্রয়: পুঁজি থেকে টাকা বেরোয়
  IF v_inv.type = 'purchase' THEN
    v_change := -v_inv.paid_amount;
  -- বিক্রয়: পুঁজিতে টাকা আসে
  ELSIF v_inv.type = 'sale' THEN
    v_change := v_inv.paid_amount;
  -- খরচ: পুঁজি থেকে বেরোয়
  ELSIF v_inv.type = 'expense' THEN
    v_change := -v_inv.paid_amount;
  ELSE
    v_change := 0;
  END IF;

  IF v_change <> 0 THEN
    UPDATE public.business_capital
       SET current_balance = current_balance + v_change,
           updated_at = now()
     WHERE 1=1;
  END IF;

  PERFORM set_config('hb.sys', 'off', true);
END;
$$;

-- ४. গুদাম তৈরি করা
CREATE OR REPLACE FUNCTION public.hb_save_warehouse(p JSONB)
RETURNS public.warehouses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.warehouses;
  v_id  UUID := nullif(p ->> 'id', '')::UUID;
BEGIN
  IF v_id IS NULL THEN
    -- নতুন গুদাম
    INSERT INTO public.warehouses (
      name, description, location, created_by, created_by_name
    ) VALUES (
      btrim(p ->> 'name'),
      nullif(btrim(p ->> 'description'), ''),
      nullif(btrim(p ->> 'location'), ''),
      auth.uid(), public.hb_actor_name()
    ) RETURNING * INTO v_row;
  ELSE
    -- বিদ্যমান গুদাম আপডেট
    UPDATE public.warehouses
       SET name = btrim(p ->> 'name'),
           description = nullif(btrim(p ->> 'description'), ''),
           location = nullif(btrim(p ->> 'location'), ''),
           is_active = coalesce((p ->> 'is_active')::BOOLEAN, true),
           updated_at = now()
     WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- ५. অগ্রিম পেমেন্ট যোগ করা
CREATE OR REPLACE FUNCTION public.hb_add_advance_payment(p JSONB)
RETURNS public.advance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     public.advance_payments;
  v_inv     public.invoices;
  v_amount  NUMERIC := round(coalesce((p ->> 'amount')::NUMERIC, 0), 2);
  v_on      DATE := coalesce((p ->> 'paid_on')::DATE, current_date);
  v_actor   TEXT := public.hb_actor_name();
BEGIN
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'অগ্রিম পেমেন্ট শূন্যের বেশি হতে হবে।'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_on > current_date THEN
    RAISE EXCEPTION 'ভবিষ্যতের তারিখে অগ্রিম পেমেন্ট লেখা যায় না।'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = (p ->> 'invoice_id')::UUID;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'চালানটি খুঁজে পাওয়া যায়নি।'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_inv.type <> 'purchase' THEN
    RAISE EXCEPTION 'শুধু ক্রয়ের জন্য অগ্রিম পেমেন্ট করা যায়।'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('hb.sys', 'on', true);

  INSERT INTO public.advance_payments (
    invoice_id, amount, paid_on, method, note,
    created_by, created_by_name
  ) VALUES (
    v_inv.id, v_amount, v_on,
    coalesce(nullif(p ->> 'method', ''), 'cash')::public.hb_payment_method,
    nullif(btrim(p ->> 'note'), ''),
    auth.uid(), v_actor
  ) RETURNING * INTO v_row;

  -- চালানে পরিশোধিত অঙ্ক আপডেট করো
  UPDATE public.invoices
     SET paid_amount = paid_amount + v_amount
   WHERE id = v_inv.id;

  PERFORM set_config('hb.sys', 'off', true);
  RETURN v_row;
END;
$$;

-- ६. চালান তৈরির সময় পুঁজি আপডেট (হুক হিসেবে)
-- এটা hb_create_invoice ফাংশনের শেষে কল করা হবে
-- CREATE OR REPLACE FUNCTION public.hb_invoice_created_hook()
-- ... আপডেট করা হবে আগের ফাংশনে

-- ७. ব্যবসায়িক সারাংশ পান
CREATE OR REPLACE FUNCTION public.hb_get_business_summary()
RETURNS TABLE (
  current_capital NUMERIC,
  total_investment NUMERIC,
  opening_balance NUMERIC,
  total_sales NUMERIC,
  total_purchases NUMERIC,
  total_expenses NUMERIC,
  total_profit NUMERIC,
  pending_invoices BIGINT,
  total_due NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.current_balance,
    bc.total_investment,
    bc.opening_balance,
    coalesce(sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.total_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN i.type = 'expense' THEN i.total_amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN i.type = 'sale' THEN i.profit ELSE 0 END), 0),
    count(DISTINCT CASE WHEN i.due_amount > 0 THEN i.id END),
    coalesce(sum(CASE WHEN i.due_amount > 0 THEN i.due_amount ELSE 0 END), 0)
  FROM public.business_capital bc
  CROSS JOIN public.invoices i
  GROUP BY bc.id, bc.current_balance, bc.total_investment, bc.opening_balance;
END;
$$;
