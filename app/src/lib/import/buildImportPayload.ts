import { SupabaseClient } from '@supabase/supabase-js';

export interface ImportPayload {
  productsById: Record<string, any>;
  projectMaterialsById: Record<string, any>;
  linesByProductId: Record<string, {
    materialLines: any[];
    laborLines: any[];
    transportLines: any[];
    otherCostLines: any[];
  }>;
  stats: {
    productCount: number;
    materialCount: number;
    materialLineCount: number;
    laborLineCount: number;
    transportLineCount: number;
    otherCostLineCount: number;
  };
}

/**
 * Builds an import payload for products from a source project
 * @param supabase - Supabase client
 * @param sourceProjectId - ID of the source project
 * @param productIds - Array of product IDs to import
 * @returns ImportPayload with all related data
 */
export async function buildImportPayload(
  supabase: SupabaseClient,
  sourceProjectId: string,
  productIds: string[]
): Promise<ImportPayload> {
  console.log('🔄 Building import payload...', { sourceProjectId, productIds });

  try {
    // Step 1: Hent products
    console.log('📦 Fetching products...');
    const { data: products, error: productsError } = await supabase
      .from('project_products_2026_01_15_12_49')
      .select('*')
      .eq('project_id', sourceProjectId)
      .in('id', productIds);

    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      throw productsError;
    }

    console.log(`✅ Found ${products?.length || 0} products`);

    // Step 2: Hent material lines
    console.log('🧱 Fetching material lines...');
    const { data: materialLines, error: materialLinesError } = await supabase
      .from('project_product_material_lines_2026_01_15_12_49')
      .select('*')
      .in('project_product_id', productIds);

    if (materialLinesError) {
      console.error('❌ Error fetching material lines:', materialLinesError);
      throw materialLinesError;
    }

    console.log(`✅ Found ${materialLines?.length || 0} material lines`);

    // Step 3: Udtræk unikke project_material_id fra material lines
    const uniqueMaterialIds = Array.from(
      new Set(
        (materialLines || [])
          .map(line => line.project_material_id)
          .filter(id => id) // Remove null/undefined
      )
    );

    console.log(`🔍 Found ${uniqueMaterialIds.length} unique material IDs`);

    // Step 4: Hent project materials
    let projectMaterials: any[] = [];
    if (uniqueMaterialIds.length > 0) {
      console.log('📋 Fetching project materials...');
      const { data: materials, error: materialsError } = await supabase
        .from('project_materials_2026_01_15_06_45')
        .select('*')
        .eq('project_id', sourceProjectId)
        .in('id', uniqueMaterialIds);

      if (materialsError) {
        console.error('❌ Error fetching project materials:', materialsError);
        throw materialsError;
      }

      projectMaterials = materials || [];
      console.log(`✅ Found ${projectMaterials.length} project materials`);
    }

    // Step 5: Hent labor lines
    console.log('👷 Fetching labor lines...');
    const { data: laborLines, error: laborLinesError } = await supabase
      .from('project_product_labor_lines_2026_01_15_12_49')
      .select('*')
      .in('project_product_id', productIds);

    if (laborLinesError) {
      console.error('❌ Error fetching labor lines:', laborLinesError);
      throw laborLinesError;
    }

    console.log(`✅ Found ${laborLines?.length || 0} labor lines`);

    // Step 6: Hent transport lines
    console.log('🚚 Fetching transport lines...');
    const { data: transportLines, error: transportLinesError } = await supabase
      .from('project_product_transport_lines_2026_01_15_12_49')
      .select('*')
      .in('project_product_id', productIds);

    if (transportLinesError) {
      console.error('❌ Error fetching transport lines:', transportLinesError);
      throw transportLinesError;
    }

    console.log(`✅ Found ${transportLines?.length || 0} transport lines`);

    // Step 7: Hent other cost lines
    console.log('💰 Fetching other cost lines...');
    const { data: otherCostLines, error: otherCostLinesError } = await supabase
      .from('project_product_other_cost_lines_2026_01_15_12_49')
      .select('*')
      .in('project_product_id', productIds);

    if (otherCostLinesError) {
      console.error('❌ Error fetching other cost lines:', otherCostLinesError);
      throw otherCostLinesError;
    }

    console.log(`✅ Found ${otherCostLines?.length || 0} other cost lines`);

    // Step 8: Saml payload
    console.log('🔧 Building payload structure...');

    // Products by ID
    const productsById: Record<string, any> = {};
    (products || []).forEach(product => {
      productsById[product.id] = product;
    });

    // Project materials by ID
    const projectMaterialsById: Record<string, any> = {};
    projectMaterials.forEach(material => {
      projectMaterialsById[material.id] = material;
    });

    // Lines by product ID
    const linesByProductId: Record<string, any> = {};
    productIds.forEach(productId => {
      linesByProductId[productId] = {
        materialLines: (materialLines || []).filter(line => line.project_product_id === productId),
        laborLines: (laborLines || []).filter(line => line.project_product_id === productId),
        transportLines: (transportLines || []).filter(line => line.project_product_id === productId),
        otherCostLines: (otherCostLines || []).filter(line => line.project_product_id === productId)
      };
    });

    // Stats
    const stats = {
      productCount: products?.length || 0,
      materialCount: projectMaterials.length,
      materialLineCount: materialLines?.length || 0,
      laborLineCount: laborLines?.length || 0,
      transportLineCount: transportLines?.length || 0,
      otherCostLineCount: otherCostLines?.length || 0
    };

    const payload: ImportPayload = {
      productsById,
      projectMaterialsById,
      linesByProductId,
      stats
    };

    console.log('✅ Import payload built successfully:', stats);
    return payload;

  } catch (error) {
    console.error('❌ Error building import payload:', error);
    throw error;
  }
}