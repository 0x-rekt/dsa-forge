-- Time to first streamed token, measured from request start. Needed by the
-- PRD's speed metric ("first streamed token in a few seconds").
ALTER TABLE "query_log" ADD COLUMN "ttftMs" INTEGER;