// Script to run position_history migration on Supabase cloud
// Usage: npx ts-node --compiler-options '{"module":"commonjs"}' scratch/run_position_history_migration.ts

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function runMigration() {
  const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260427000000_create_position_history.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  
  console.log('Running migration: 20260427000000_create_position_history.sql')
  console.log('---')
  
  // Split SQL into individual statements, handling DO $$ blocks
  const statements = splitSqlStatements(sql)
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    if (!stmt) continue
    
    console.log(`\nExecuting statement ${i + 1}/${statements.length}:`)
    console.log(stmt.substring(0, 150) + (stmt.length > 150 ? '...' : ''))
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_text: stmt }).single()
      
      if (error) {
        // Try raw SQL via REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql_text: stmt })
        })
        
        if (!response.ok) {
          const errText = await response.text()
          console.error(`  Error (${response.status}): ${errText.substring(0, 200)}`)
          
          // If statement already exists (table, index, etc.), continue
          if (errText.includes('already exists') || errText.includes('duplicate')) {
            console.log('  -> Already exists, skipping.')
            continue
          }
        } else {
          console.log('  -> OK via REST')
        }
      } else {
        console.log('  -> OK')
      }
    } catch (e: any) {
      console.error(`  Error: ${e.message}`)
    }
  }
  
  console.log('\n--- Migration complete ---')
  
  // Verify tables were created
  console.log('\nVerifying...')
  const { data: tables, error: verifyError } = await supabase
    .from('position_history')
    .select('count')
    .limit(1)
  
  if (verifyError) {
    console.error('Verification failed:', verifyError.message)
    
    // Try alternate verification via REST
    const verifyRes = await fetch(`${supabaseUrl}/rest/v1/position_history?limit=1`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    })
    if (verifyRes.ok) {
      console.log('position_history table exists and is accessible via REST API!')
    } else {
      console.error('Could not verify position_history table. You may need to run the migration manually in Supabase SQL Editor.')
      console.log('SQL file location: supabase/migrations/20260427000000_create_position_history.sql')
    }
  } else {
    console.log('position_history table exists and is accessible!')
  }
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inDollarBlock = false
  let dollarTag = ''
  
  const lines = sql.split('\n')
  
  for (const line of lines) {
    // Check for DO $$ or CREATE OR REPLACE FUNCTION $$ etc.
    const dollarMatch = line.match(/\$\$/);
    if (dollarMatch && !inDollarBlock) {
      inDollarBlock = true
      dollarTag = '$$'
      current += line + '\n'
      continue
    }
    
    if (inDollarBlock) {
      current += line + '\n'
      // Check for end of dollar block
      if (line.includes(dollarTag) && !line.includes('DECLARE') && !line.includes('BEGIN') && !line.trim().startsWith('--')) {
        // This could be END; $$ or just $$
        if (line.includes('END;') || line.trim() === '$$' || line.includes('END $$') || line.includes('LANGUAGE')) {
          inDollarBlock = false
          if (current.trim()) {
            statements.push(current.trim())
            current = ''
          }
        }
      }
      continue
    }
    
    // Normal statement
    if (line.trim().startsWith('--')) {
      // Skip comments when collecting statements (but keep them in the statement text)
      if (!current.trim()) continue // Skip leading comments between statements
      current += line + '\n'
      continue
    }
    
    current += line + '\n'
    
    // End of statement (semicolon at end of line or empty line followed by new statement start)
    if (line.trim().endsWith(';')) {
      const stmt = current.trim()
      if (stmt && stmt !== ';') {
        statements.push(stmt)
      }
      current = ''
    }
  }
  
  // Remaining
  if (current.trim()) {
    statements.push(current.trim())
  }
  
  return statements
}

runMigration().catch(console.error)