import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://duzcfofnmpelzcudaify.supabase.co'
const SUPABASE_KEY = 'sb_publishable_6XrV6BjV_vBytAhNlHD-xQ_X_MRD5Y4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
