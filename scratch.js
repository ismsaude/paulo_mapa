const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hfztccrfgdisebvjvgnf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmenRjY3JmZ2Rpc2Vidmp2Z25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NDU1NDMsImV4cCI6MjA5MjIyMTU0M30._-dWE7TXY-RDvF1HyKMDnkMf_AsDdX_P68ltEunXEgI'
);

async function test() {
  const { data: terrs } = await supabase.from('territorios').select('*').limit(1);
  console.log("Terr", terrs);
  
  if (terrs && terrs.length > 0) {
    const { error } = await supabase.from('quadras').insert([{ nome: 'TesteQuadra', territorio_id: terrs[0].id }]);
    console.log("Insert result:", error);
  }
}
test();
