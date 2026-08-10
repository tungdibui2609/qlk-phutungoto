const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'supabase', 'migrations');

// 1. Clean corrupted files ending with '筋'
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('筋')) {
    const oldPath = path.join(dir, file);
    const cleanName = file.replace('筋', '');
    const cleanPath = path.join(dir, cleanName);
    if (fs.existsSync(cleanPath)) {
      console.log('Deleting duplicate corrupted file:', file);
      fs.unlinkSync(oldPath);
    } else {
      console.log('Renaming corrupted file to:', cleanName);
      fs.renameSync(oldPath, cleanPath);
    }
  }
});

// 2. Map short or duplicate timestamp prefixes
const renames = {
  '20240128_create_site_loans.sql': '20240128000000_create_site_loans.sql',
  '20240129_add_company_code.sql': '20240129000000_add_company_code.sql',
  '20260210_add_lot_adjusted_columns.sql': '20260210000000_add_lot_adjusted_columns.sql',
  '20260210_add_lot_system_quantity.sql': '20260210000001_add_lot_system_quantity.sql',
  '20260210_approve_inventory_check.sql': '20260210000002_approve_inventory_check.sql',
  '20260213_add_use_full_title.sql': '20260213000000_add_use_full_title.sql',
  '20260307_create_internal_inventory.sql': '20260307000001_create_internal_inventory.sql',
  '20260530_create_production_lots.sql': '20260530000000_create_production_lots.sql',
  '20260530_semi_finished_lots.sql': '20260530000001_semi_finished_lots.sql',
  'add_company_id_to_positions.sql': '20260621000000_add_company_id_to_positions.sql',
  'enable_realtime_positions.sql': '20260621000001_enable_realtime_positions.sql',
  'fresh_material_tables.sql': '20260621000002_fresh_material_tables.sql',

  // Duplicate timestamp fixes
  '20260130000000_secure_inventory_tenancy.sql': '20260130000005_secure_inventory_tenancy.sql',
  '20260130000002_fix_order_types_cascade.sql': '20260130000006_fix_order_types_cascade.sql',
  '20260130000003_fix_pricing_module.sql': '20260130000007_fix_pricing_module.sql',
  '20260130000004_robust_fix_pricing.sql': '20260130000008_robust_fix_pricing.sql',
  '20260201140000_create_app_modules_table.sql': '20260201140001_create_app_modules_table.sql',
  '20260323070000_add_warehouse_lot_permissions.sql': '20260323070001_add_warehouse_lot_permissions.sql',
  '20260427000000_create_position_history_idempotent.sql': '20260427000001_create_position_history_idempotent.sql',
  '20260521999999_optimize_rls_and_indexes_rollback.sql': '20260521999998_optimize_rls_and_indexes_rollback.sql'
};

for (const [oldName, newName] of Object.entries(renames)) {
  const oldPath = path.join(dir, oldName);
  const newPath = path.join(dir, newName);
  if (fs.existsSync(oldPath)) {
    console.log(`Renaming: ${oldName} -> ${newName}`);
    fs.renameSync(oldPath, newPath);
  }
}

console.log('Migration filenames cleanup complete.');
