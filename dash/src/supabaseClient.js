import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://erpmyorddhgxfdrmwouj.supabase.co'
const supabaseKey = 'sb_publishable_Z4Q89aawz4_5JDLg69qI6Q_4-w0pAZ9'

export const supabase = createClient(supabaseUrl, supabaseKey)
