const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hfztccrfgdisebvjvgnf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmenRjY3JmZ2Rpc2Vidmp2Z25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NDU1NDMsImV4cCI6MjA5MjIyMTU0M30._-dWE7TXY-RDvF1HyKMDnkMf_AsDdX_P68ltEunXEgI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('enderecos').select('rua, ordem_rua').limit(5);
  console.log("data:", data);
  console.log("error:", error);
}
check();
