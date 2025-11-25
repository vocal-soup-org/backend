// src/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qviplksdhdsfeceuotww.supabase.co";
const serviceRoleKey = "sb_secret_D6Dbo3D_JT2alJs5ZnMUAg_kmd0Nu1U";


// Admin client – full power, keep this on the server only
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
