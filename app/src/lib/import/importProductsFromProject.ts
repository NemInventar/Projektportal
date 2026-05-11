import { SupabaseClient } from '@supabase/supabase-js';
import { buildImportPayload } from './buildImportPayload';

export interface ImportResult {
  materialIdMap: Record<string, string>;
  productIdMap: Record<string, string>;
  insertedCounts: {
    materials: number;
    products: number;
    materialLines: number;
    laborLines: number;
    transportLines: number;
    otherCostLines: number;
  };
}

export interface ImportOptions {
  includeExtraLines?: boolean;
}

/**
 * Imports products and all related data from source project to target project
 * @param supabase - Supabase client
 * @param sourceProjectId - ID of the source project
 * @param targetProjectId - ID of the target project
 * @param productIds - Array of product IDs to import
 * @param options - Import options
 * @returns ImportResult with mappings and counts
 */
export async function importProductsFromProject(
  supabase: SupabaseClient,
  sourceProjectId: string,
  targetProjectId: string,
  productIds: string[],
  options: ImportOptions = { includeExtraLines: true }
): Promise<ImportResult> {
  console.log('🚀 Starting product import...', { 
    sourceProjectId, 
    targetProjectId, 
    productIds, 
    options 
  });

  try {
    // Step 1: Build import payload using existing function
    console.log('📦 Building import payload...');
    const payload = await buildImportPayload(supabase, sourceProjectId, productIds);
    
    console.log('✅ Payload built:', payload.stats);

    // Initialize result and tracking counters
    const result: ImportResult = {
      materialIdMap: {},
      productIdMap: {},
      insertedCounts: {
        materials: 0,
        products: 0,
        materialLines: 0,
        laborLines: 0,
        transportLines: 0,
        otherCostLines: 0
      }
    };

    // Track counts during import
    let insertedMaterials = 0;
    let insertedProducts = 0;
    let insertedMaterialLines = 0;
    let insertedLaborLines = 0;
    let insertedTransportLines = 0;
    let insertedOtherLines = 0;

    // Step 2: Import project materials first (V1: Create New - always create new materials)
    console.log('🧱 Importing project materials...');
    const materialIds = Object.keys(payload.projectMaterialsById);
    
    for (const sourceMaterialId of materialIds) {
      const sourceMaterial = payload.projectMaterialsById[sourceMaterialId];
      
      // Prepare material data for insert
      const materialData = {
        ...sourceMaterial,
        project_id: targetProjectId, // Set target project ID
        // Remove fields that should be auto-generated
        id: undefined,
        created_at: undefined,
        updated_at: undefined
      };

      // Remove undefined fields
      Object.keys(materialData).forEach(key => {
        if (materialData[key] === undefined) {
          delete materialData[key];
        }
      });

      console.log(`📋 Inserting material: ${sourceMaterial.name}`);
      
      const { data: insertedMaterial, error: materialError } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .insert(materialData)
        .select('id')
        .single();

      if (materialError) {
        console.error('❌ Error inserting material:', materialError);
        throw materialError;
      }

      // Verify insert returned data
      if (!insertedMaterial || !insertedMaterial.id) {
        throw new Error(`Material insert failed - no ID returned for ${sourceMaterial.name}`);
      }

      // Build material ID mapping and increment count
      result.materialIdMap[sourceMaterialId] = insertedMaterial.id;
      insertedMaterials++;
      result.insertedCounts.materials = insertedMaterials;
      
      console.log(`✅ Material mapped: ${sourceMaterialId} → ${insertedMaterial.id} (${insertedMaterials} total)`);
    }

    // Step 3: Import products
    console.log('📦 Importing products...');
    
    for (const sourceProductId of productIds) {
      const sourceProduct = payload.productsById[sourceProductId];
      
      if (!sourceProduct) {
        console.warn(`⚠️ Product ${sourceProductId} not found in payload`);
        continue;
      }

      // Prepare product name with import suffix (avoid duplicates)
      let productName = sourceProduct.name;
      if (!productName.endsWith(' (import)')) {
        productName = `${productName} (import)`;
      }

      // Prepare product data for insert
      const productData = {
        ...sourceProduct,
        project_id: targetProjectId, // Set target project ID
        name: productName, // Add import suffix (avoiding duplicates)
        // Remove fields that should be auto-generated
        id: undefined,
        created_at: undefined,
        updated_at: undefined
      };

      // Remove undefined fields
      Object.keys(productData).forEach(key => {
        if (productData[key] === undefined) {
          delete productData[key];
        }
      });

      console.log(`📦 Inserting product: ${productData.name}`);
      
      const { data: insertedProduct, error: productError } = await supabase
        .from('project_products_2026_01_15_12_49')
        .insert(productData)
        .select('id')
        .single();

      if (productError) {
        console.error('❌ Error inserting product:', productError);
        throw productError;
      }

      // Verify insert returned data
      if (!insertedProduct || !insertedProduct.id) {
        throw new Error(`Product insert failed - no ID returned for ${productData.name}`);
      }

      // Build product ID mapping and increment count
      result.productIdMap[sourceProductId] = insertedProduct.id;
      insertedProducts++;
      result.insertedCounts.products = insertedProducts;
      
      console.log(`✅ Product mapped: ${sourceProductId} → ${insertedProduct.id} (${insertedProducts} total)`);
    }

    // Step 4: Import material lines (always included)
    console.log('🔗 Importing material lines...');
    
    for (const sourceProductId of productIds) {
      const targetProductId = result.productIdMap[sourceProductId];
      if (!targetProductId) continue;

      const materialLines = payload.linesByProductId[sourceProductId]?.materialLines || [];
      
      for (const sourceLine of materialLines) {
        const targetMaterialId = result.materialIdMap[sourceLine.project_material_id];
        
        if (!targetMaterialId) {
          console.warn(`⚠️ Material ID ${sourceLine.project_material_id} not found in mapping`);
          continue;
        }

        // Prepare material line data for insert
        const lineData = {
          ...sourceLine,
          project_product_id: targetProductId, // Remap to target product
          project_material_id: targetMaterialId, // Remap to target material
          // Remove fields that should be auto-generated
          id: undefined,
          created_at: undefined,
          updated_at: undefined
        };

        // Remove undefined fields
        Object.keys(lineData).forEach(key => {
          if (lineData[key] === undefined) {
            delete lineData[key];
          }
        });

        const { data: insertedLine, error: lineError } = await supabase
          .from('project_product_material_lines_2026_01_15_12_49')
          .insert(lineData)
          .select('id');

        if (lineError) {
          console.error('❌ Error inserting material line:', lineError);
          throw lineError;
        }

        // Verify insert and increment count
        if (insertedLine && insertedLine.length > 0) {
          insertedMaterialLines++;
          result.insertedCounts.materialLines = insertedMaterialLines;
        }
      }
    }

    console.log(`✅ Material lines imported: ${insertedMaterialLines} total`);

    // Step 5: Import extra lines (labor, transport, other) if enabled
    if (options.includeExtraLines) {
      console.log('👷 Importing labor lines...');
      
      for (const sourceProductId of productIds) {
        const targetProductId = result.productIdMap[sourceProductId];
        if (!targetProductId) continue;

        const laborLines = payload.linesByProductId[sourceProductId]?.laborLines || [];
        
        for (const sourceLine of laborLines) {
          const lineData = {
            ...sourceLine,
            project_product_id: targetProductId, // Remap to target product
            // Remove fields that should be auto-generated
            id: undefined,
            created_at: undefined,
            updated_at: undefined
          };

          // Remove undefined fields
          Object.keys(lineData).forEach(key => {
            if (lineData[key] === undefined) {
              delete lineData[key];
            }
          });

          const { data: insertedLine, error: lineError } = await supabase
            .from('project_product_labor_lines_2026_01_15_12_49')
            .insert(lineData)
            .select('id');

          if (lineError) {
            console.error('❌ Error inserting labor line:', lineError);
            throw lineError;
          }

          // Verify insert and increment count
          if (insertedLine && insertedLine.length > 0) {
            insertedLaborLines++;
            result.insertedCounts.laborLines = insertedLaborLines;
          }
        }
      }

      console.log('🚚 Importing transport lines...');
      
      for (const sourceProductId of productIds) {
        const targetProductId = result.productIdMap[sourceProductId];
        if (!targetProductId) continue;

        const transportLines = payload.linesByProductId[sourceProductId]?.transportLines || [];
        
        for (const sourceLine of transportLines) {
          const lineData = {
            ...sourceLine,
            project_product_id: targetProductId, // Remap to target product
            // Remove fields that should be auto-generated
            id: undefined,
            created_at: undefined,
            updated_at: undefined
          };

          // Remove undefined fields
          Object.keys(lineData).forEach(key => {
            if (lineData[key] === undefined) {
              delete lineData[key];
            }
          });

          const { data: insertedLine, error: lineError } = await supabase
            .from('project_product_transport_lines_2026_01_15_12_49')
            .insert(lineData)
            .select('id');

          if (lineError) {
            console.error('❌ Error inserting transport line:', lineError);
            throw lineError;
          }

          // Verify insert and increment count
          if (insertedLine && insertedLine.length > 0) {
            insertedTransportLines++;
            result.insertedCounts.transportLines = insertedTransportLines;
          }
        }
      }

      console.log('💰 Importing other cost lines...');
      
      for (const sourceProductId of productIds) {
        const targetProductId = result.productIdMap[sourceProductId];
        if (!targetProductId) continue;

        const otherCostLines = payload.linesByProductId[sourceProductId]?.otherCostLines || [];
        
        for (const sourceLine of otherCostLines) {
          const lineData = {
            ...sourceLine,
            project_product_id: targetProductId, // Remap to target product
            // Remove fields that should be auto-generated
            id: undefined,
            created_at: undefined,
            updated_at: undefined
          };

          // Remove undefined fields
          Object.keys(lineData).forEach(key => {
            if (lineData[key] === undefined) {
              delete lineData[key];
            }
          });

          const { data: insertedLine, error: lineError } = await supabase
            .from('project_product_other_cost_lines_2026_01_15_12_49')
            .insert(lineData)
            .select('id');

          if (lineError) {
            console.error('❌ Error inserting other cost line:', lineError);
            throw lineError;
          }

          // Verify insert and increment count
          if (insertedLine && insertedLine.length > 0) {
            insertedOtherLines++;
            result.insertedCounts.otherCostLines = insertedOtherLines;
          }
        }
      }
    }

    console.log('✅ Import completed successfully!');
    console.log('📊 Final counts:', {
      materials: insertedMaterials,
      products: insertedProducts,
      materialLines: insertedMaterialLines,
      laborLines: insertedLaborLines,
      transportLines: insertedTransportLines,
      otherLines: insertedOtherLines
    });
    console.log('🗺️ Material ID mappings:', result.materialIdMap);
    console.log('🗺️ Product ID mappings:', result.productIdMap);

    return result;

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}