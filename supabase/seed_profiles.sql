insert into public.profiles (id, full_name, role) values
('04f2c57a-e400-476a-b101-03eabc01bbfd', 'AMY', 'worker'),
('7627d83a-8c7b-4060-84f5-d5ea7c5f4af2', 'DINO', 'worker'),
('8a3023b9-11b7-49c1-8c90-7c78c01e7991', 'ELLEN', 'worker'),
('0ee3e45c-58a7-4e63-b10e-a021ce86485f', 'HUSTEL', 'worker'),
('58e5d439-4884-4a56-88f4-88e6247976e7', 'ADMIN', 'admin')
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role;
