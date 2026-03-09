
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProduct() {
    const productId = '14e4a450-b0ff-407c-8b86-6ff42c3dbfa2';
    const { data, error } = await supabase.from('products').select('*').eq('id', productId).single();

    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Product found:", JSON.stringify(data, null, 2));
    }
}

checkProduct();
