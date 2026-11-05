begin;

-- O composer aceita áudio até 20 MiB; o bucket legado estava limitado a 12 MiB,
-- o que podia rejeitar uma gravação depois de ela aparecer como válida na interface.
update storage.buckets
set file_size_limit = case
  when file_size_limit is null then null
  else greatest(file_size_limit, 20971520)
end
where id = 'message-attachments';

commit;
