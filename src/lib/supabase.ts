import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** .env 가 비어 있으면 null — 화면은 뜨고 로그인 시 설정 안내를 보여준다. */
export const supabase = url && key ? createClient(url, key) : null
