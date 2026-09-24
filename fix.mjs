
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const sql = fs.readFileSync("supabase/migrations/20260907000000_fix_public_surface_counts_topics.sql", "utf-8");
console.log(sql);

