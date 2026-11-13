-- Tracks commission payments so outstanding balances (worker restrictions and
-- platform statistics) reflect what was actually collected.
CREATE TABLE IF NOT EXISTS public.commission_payments (
  id             UUID NOT NULL,
  commission_id  UUID NOT NULL,
  montant        BIGINT NOT NULL,
  methode        VARCHAR(50),
  reference      VARCHAR(255),
  enregistre_par UUID,
  created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT pk_commission_payments PRIMARY KEY (id),
  CONSTRAINT fk_commission_payments_commission
    FOREIGN KEY (commission_id) REFERENCES public.commissions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_commission_payments_montant CHECK (montant > 0)
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_commission_id
  ON public.commission_payments(commission_id);

CREATE INDEX IF NOT EXISTS idx_commission_payments_created_at
  ON public.commission_payments(created_at);
