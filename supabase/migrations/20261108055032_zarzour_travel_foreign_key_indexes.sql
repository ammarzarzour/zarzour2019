create index travel_bookings_program_idx on public.travel_bookings(program_id);
create index travel_bookings_campaign_idx on public.travel_bookings(campaign_id);
create index pilgrims_customer_idx on public.pilgrims(customer_id);
create index pilgrims_guarantor_idx on public.pilgrims(guarantor_id);
create index travel_contracts_partner_idx on public.travel_contracts(partner_id);
create index travel_commissions_booking_idx on public.travel_commissions(booking_id);
