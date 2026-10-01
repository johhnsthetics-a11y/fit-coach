begin;

alter function public.get_affiliate_finance_report(date, date)
  set timezone to 'America/Sao_Paulo';

commit;
