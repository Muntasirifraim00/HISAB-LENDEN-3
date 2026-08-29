-- =====================================================================
-- চালান টেবিল আপডেট - গ্রাহক এবং বিক্রেতা যুক্ত করা
-- =====================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

CREATE INDEX IF NOT EXISTS invoices_customer_idx ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_supplier_idx ON public.invoices (supplier_id);

-- =====================================================================
-- চালান তৈরি ফাংশন আপডেট
-- =====================================================================

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
BEGIN
  -- ---- সেভ করার আগে পরীক্ষা ----
  IF v_date > current_date THEN
    RAISE EXCEPTION 'ভবিষ্যতের তারিখে হিসাব লেখা যায় না।' USING ERRCODE = 'check_violation';
  END IF;

  IF nullif(p ->> 'image_url', '') IS NULL
     AND coalesce(length(btrim(p ->> 'no_image_reason')), 0) < 3 THEN
    RAISE EXCEPTION 'ছবি না থাকলে কারণ লিখতে হবে।' USING ERRCODE = 'check_violation';
  END IF;

  -- গুদাম আছে কিনা চেক করো
  IF v_warehouse IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = v_warehouse AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত গুদামটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- গ্রাহক আছে কিনা চেক করো (বিক্রয়ের জন্য)
  IF v_type = 'sale' AND v_customer IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত গ্রাহকটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
    -- গ্রাহকের নাম স্বয়ংক্রিয়ভাবে পান
    SELECT name INTO v_party FROM public.customers WHERE id = v_customer;
  END IF;

  -- বিক্রেতা আছে কিনা চেক করো (ক্রয়ের জন্য)
  IF v_type = 'purchase' AND v_supplier IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = v_supplier AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত বিক্রেতাটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
    -- বিক্রেতার নাম স্বয়ংক্রিয়ভাবে পান
    SELECT name INTO v_party FROM public.suppliers WHERE id = v_supplier;
  END IF;

  -- ---- পরিশোধের নিয়ম ----
  IF v_nothing THEN
    v_paid := 0;
  ELSIF v_paid_raw IS NULL OR v_paid_raw = 0 THEN
    v_paid := v_total;
  ELSE
    v_paid := LEAST(round(v_paid_raw, 2), v_total);
  END IF;

  -- ---- অগ্রিম ক্রয়: টাকা গেল, মাল আসেনি ----
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

  -- ---- খাতওয়ারি খরচ ----
  FOR v_exp IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'expenses', '[]'::jsonb)) LOOP
    INSERT INTO public.invoice_expenses (invoice_id, head, amount, note)
    VALUES (
      v_inv.id,
      btrim(v_exp ->> 'head'),
      round(coalesce((v_exp ->> 'amount')::NUMERIC, 0), 2),
      nullif(btrim(v_exp ->> 'note'), '')
    );
  END LOOP;

  -- ---- পণ্যের সারি + স্টকের প্রভাব ----
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) LOOP
    v_pid := nullif(v_item ->> 'product_id', '')::UUID;
    v_qty := round(coalesce((v_item ->> 'qty')::NUMERIC, 0), 3);
    CONTINUE WHEN v_qty <= 0;

    v_line := round(coalesce((v_item ->> 'line_total')::NUMERIC,
                             v_qty * coalesce((v_item ->> 'unit_price')::NUMERIC, 0)), 2);

    SELECT coalesce(pr.cost_price, 0), coalesce(pr.unit, 'pcs')
      INTO v_cost_ref, v_unit
      FROM public.products pr WHERE pr.id = v_pid;
    v_cost_ref := coalesce(v_cost_ref, 0);
    v_unit := coalesce(v_unit, 'pcs');

    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, qty, unit, unit_price, cost_price, line_total
    ) VALUES (
      v_inv.id, v_pid,
      coalesce(nullif(btrim(v_item ->> 'product_name'), ''), 'পণ্য'),
      v_qty, v_unit,
      round(coalesce((v_item ->> 'unit_price')::NUMERIC, 0), 2),
      v_cost_ref, v_line
    ) RETURNING id INTO v_item_id;

    IF v_pid IS NULL THEN CONTINUE; END IF;

    PERFORM set_config('hb.sys', 'on', true);

    IF v_type = 'purchase' AND NOT v_advance THEN
      INSERT INTO public.stock_lots (product_id, invoice_id, lot_date, qty_in, qty_remaining, unit_cost, reason)
      VALUES (v_pid, v_inv.id, v_date, v_qty, v_qty,
              CASE WHEN v_qty > 0 THEN round(v_line / v_qty, 4) ELSE 0 END, 'purchase');

      INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, created_by_name)
      VALUES (v_pid, v_inv.id, v_date, v_qty,
              CASE WHEN v_qty > 0 THEN round(v_line / v_qty, 4) ELSE 0 END, 'purchase', v_actor);

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

  -- ---- লাভ (শুধু বিক্রয়ে), ডেটাবেসেই হিসাব ----
  PERFORM set_config('hb.sys', 'on', true);
  UPDATE public.invoices
     SET cogs            = CASE WHEN v_type = 'sale' THEN round(v_cogs, 2) ELSE 0 END,
         profit          = CASE WHEN v_type = 'sale' THEN round(v_total - v_cogs, 2) ELSE 0 END,
         stock_shortfall = v_short
   WHERE id = v_inv.id
   RETURNING * INTO v_inv;
  PERFORM set_config('hb.sys', 'off', true);

  -- ---- পুঁজি আপডেট করো ----
  PERFORM public.hb_update_capital_after_transaction(v_inv.id);

  RETURN v_inv;
END;
$$;
