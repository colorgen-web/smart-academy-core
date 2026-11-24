-- 학원 엠블렘(로고) 이미지
-- 원장이 학원 등록 때, 또는 학원 화면에서 나중에 올린다. 메인 화면 "내 학원"과 학원 화면에 보인다.
-- 앱이 256px 정사각형으로 줄여 data URL(webp/png/jpeg) 로 저장한다. 따로 Storage 버킷을 만들 필요가 없다.

alter table public.academies
  add column emblem text
  check (emblem is null or (emblem ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(emblem) <= 200000));

-- 원장(등록한 원장 또는 승인된 원장) 또는 운영자: 엠블렘 바꾸기 / 지우기(null)
create function public.set_academy_emblem(p_academy_id bigint, p_emblem text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.academies where id = p_academy_id;
  if not found then
    raise exception '없는 학원입니다.' using errcode = 'P0002';
  end if;
  if v_owner is distinct from auth.uid() and not public.is_academy_director(p_academy_id) and not public.is_admin() then
    raise exception '원장이나 운영자만 엠블렘을 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if p_emblem is not null
     and (p_emblem !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' or char_length(p_emblem) > 200000) then
    raise exception '이미지가 올바르지 않거나 너무 큽니다.' using errcode = '22023';
  end if;

  update public.academies set emblem = p_emblem where id = p_academy_id;
end;
$$;

revoke execute on function public.set_academy_emblem(bigint, text) from public, anon;
grant execute on function public.set_academy_emblem(bigint, text) to authenticated;
