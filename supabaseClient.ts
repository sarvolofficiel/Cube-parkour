import { createClient } from '@supabase/supabase-js'

// Remplace par tes vraies infos du dashboard Supabase
const supabaseUrl = 'https://vagvryrdyxpjeiahnnhx.supabase.co'
const supabaseKey = 'sb_publishable__mGASjcXSJWpM5FaVw17Hw_KI-XClnd'

export const supabase = createClient(supabaseUrl, supabaseKey)
