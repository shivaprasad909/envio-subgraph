import { experimental_createEffect, S, type EffectContext } from "envio";

// Convert bytes32 to CID (same as subgraph implementation)
//
export function bytes32ToCID(dataHashHex: string): string {
  // Remove 0x prefix if present
  const cleanHex = dataHashHex.startsWith('0x') ? dataHashHex.slice(2) : dataHashHex;

  // Convert hex string to bytes
  const hashBytes = new Uint8Array(
      cleanHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
  );

  // Create multihash (sha256 + 32 bytes + hash)
  const multihash = new Uint8Array(34);
  multihash[0] = 0x12; // sha256
  multihash[1] = 0x20; // 32 bytes

  for (let i = 0; i < 32; i++) {
    multihash[i + 2] = hashBytes[i];
  }

  // Create CID data (v1 + raw codec + multihash)
  const cidData = new Uint8Array(36);
  cidData[0] = 0x01; // CID v1
  cidData[1] = 0x55; // raw codec

  for (let i = 0; i < 34; i++) {
    cidData[i + 2] = multihash[i];
  }

  // Base32 encode
  const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
  let output = "";
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cidData.length; i++) {
    value = (value << 8) | cidData[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return "b" + output;
}

// Define the schema for the IPFS metadata
const ipfsMetadataSchema = S.schema({
  label: S.string,
  relationships: S.optional(S.schema({
    property_has_structure: S.optional(S.schema({
      "/": S.string
    })),
    property_has_address: S.optional(S.schema({
      "/": S.string
    })),
    property_seed: S.optional(S.schema({
      "/": S.string
    })),
    address_has_fact_sheet: S.optional(S.array(S.schema({
      "/": S.string
    })))
  }))
});

// Schema for structure data (expanded for complete structure info)
const structureSchema = S.schema({
  // Original field
  roof_date: S.optional(S.string),
  // Expanded structure fields from JSON schema
  architectural_style_type: S.optional(S.string),
  attachment_type: S.optional(S.string),
  ceiling_condition: S.optional(S.string),
  ceiling_height_average: S.optional(S.number),
  ceiling_insulation_type: S.optional(S.string),
  ceiling_structure_material: S.optional(S.string),
  ceiling_surface_material: S.optional(S.string),
  exterior_door_material: S.optional(S.string),
  exterior_wall_condition: S.optional(S.string),
  exterior_wall_insulation_type: S.optional(S.string),
  exterior_wall_material_primary: S.optional(S.string),
  exterior_wall_material_secondary: S.optional(S.string),
  flooring_condition: S.optional(S.string),
  flooring_material_primary: S.optional(S.string),
  flooring_material_secondary: S.optional(S.string),
  foundation_condition: S.optional(S.string),
  foundation_material: S.optional(S.string),
  foundation_type: S.optional(S.string),
  foundation_waterproofing: S.optional(S.string),
  gutters_condition: S.optional(S.string),
  gutters_material: S.optional(S.string),
  interior_door_material: S.optional(S.string),
  interior_wall_condition: S.optional(S.string),
  interior_wall_finish_primary: S.optional(S.string),
  interior_wall_finish_secondary: S.optional(S.string),
  interior_wall_structure_material: S.optional(S.string),
  interior_wall_surface_material_primary: S.optional(S.string),
  interior_wall_surface_material_secondary: S.optional(S.string),
  number_of_stories: S.optional(S.number),
  primary_framing_material: S.optional(S.string),
  request_identifier: S.optional(S.string),
  roof_age_years: S.optional(S.number),
  roof_condition: S.optional(S.string),
  roof_covering_material: S.optional(S.string),
  roof_design_type: S.optional(S.string),
  roof_material_type: S.optional(S.string),
  roof_structure_material: S.optional(S.string),
  roof_underlayment_type: S.optional(S.string),
  secondary_framing_material: S.optional(S.string),
  structural_damage_indicators: S.optional(S.string),
  subfloor_material: S.optional(S.string),
  window_frame_material: S.optional(S.string),
  window_glazing_type: S.optional(S.string),
  window_operation_type: S.optional(S.string),
  window_screen_material: S.optional(S.string),
});

// Schema for address data (using exact JSON schema field names)
const addressSchema = S.schema({
  request_identifier: S.optional(S.string),
  block: S.optional(S.string),
  city_name: S.optional(S.string),
  country_code: S.optional(S.string),
  county_name: S.optional(S.string),
  latitude: S.optional(S.number),
  longitude: S.optional(S.number),
  lot: S.optional(S.string),
  municipality_name: S.optional(S.string),
  plus_four_postal_code: S.optional(S.string),
  postal_code: S.optional(S.string),
  range: S.optional(S.string),
  route_number: S.optional(S.string),
  section: S.optional(S.string),
  state_code: S.optional(S.string),
  street_name: S.optional(S.string),
  street_number: S.optional(S.string),
  street_post_directional_text: S.optional(S.string),
  street_pre_directional_text: S.optional(S.string),
  street_suffix_type: S.optional(S.string),
  township: S.optional(S.string),
  unit_identifier: S.optional(S.string),
});

// Schema for property data (for County processing)
const propertySchema = S.schema({
  property_type: S.optional(S.string),
  property_structure_built_year: S.optional(S.string),
  property_effective_built_year: S.optional(S.string),
  parcel_identifier: S.optional(S.string),
  area_under_air: S.optional(S.string),
  historic_designation: S.optional(S.boolean),
  livable_floor_area: S.optional(S.string),
  number_of_units: S.optional(S.number),
  number_of_units_type: S.optional(S.string),
  property_legal_description_text: S.optional(S.string),
  request_identifier: S.optional(S.string),
  subdivision: S.optional(S.string),
  total_area: S.optional(S.string),
  zoning: S.optional(S.string),
});

// Schema for fact sheet IPFS data (contains ipfs_url and full_generation_command)
const ipfsFactSheetSchema = S.schema({
  ipfs_url: S.optional(S.string),
  full_generation_command: S.optional(S.string),
});

// Schema for relationship data (from/to structure)
const relationshipSchema = S.schema({
  from: S.optional(S.schema({
    "/": S.string
  })),
  to: S.schema({
    "/": S.string
  })
});

// Infer the types from the schemas
type IpfsMetadata = S.Infer<typeof ipfsMetadataSchema>;
type StructureData = S.Infer<typeof structureSchema>;
type AddressData = S.Infer<typeof addressSchema>;
type PropertyData = S.Infer<typeof propertySchema>;
type RelationshipData = S.Infer<typeof relationshipSchema>;
type IpfsFactSheetData = S.Infer<typeof ipfsFactSheetSchema>;

// Gateway configuration with optional authentication tokens
const endpoints = [
  // Multiple public gateways for reliability
  { url: "https://sapphire-academic-leech-250.mypinata.cloud/ipfs", token: "CcV1DorYnAo9eZr_P4DXg8TY4SB-QuUw_b6C70JFs2M8aY0fJudBnle2mUyCYyTu" },
  { url: "https://moral-aqua-catfish.myfilebase.com/ipfs", token: null },
  { url: "https://ipfs.io/ipfs", token: null },
  { url: "https://bronze-blank-cod-736.mypinata.cloud/ipfs", token: "0EicEGVVMxNrYgog3s1-Aud_3v32eSvF9nYypTkQ4Qy-G4M8N-zdBvL1DNYjlupe" },
  { url: "https://ipfs.io/ipfs", token: null },
  { url: "https://indexing2.myfilebase.com/ipfs", token: null },
  { url: "https://gateway.ipfs.io/ipfs", token: null },
  { url: "https://dweb.link/ipfs", token: null },
  { url: "https://w3s.link/ipfs", token: null },
  { url: "https://gateway.pinata.cloud/ipfs", token: null },
  { url: "https://cloudflare-ipfs.com/ipfs", token: null },
];

// Helper function to build URL with optional token
function buildGatewayUrl(baseUrl: string, cid: string, token: string | null): string {
  const url = `${baseUrl}/${cid}`;
  if (token) {
    return `${url}?pinataGatewayToken=${token}`;
  }
  return url;
}

async function fetchFromEndpoint(
    context: EffectContext,
    endpoint: { url: string; token: string | null },
    cid: string
): Promise<IpfsMetadata | null> {
  try {
    const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
    context.log.info(`Fetching IPFS content from gateway`, { cid, endpoint: endpoint.url });

    const response = await fetch(fullUrl);

    if (response.ok) {
      const metadata: any = await response.json();

      // Extract label from metadata
      if (metadata && typeof metadata === 'object' && metadata.label && typeof metadata.label === 'string') {
        context.log.info(`Successfully fetched IPFS metadata`, { cid, label: metadata.label });
        return {
          label: metadata.label,
          relationships: metadata.relationships
        };
      } else {
        context.log.warn(`No label field found in IPFS metadata`, { cid, endpoint: endpoint.url });
        return null;
      }
    } else {
      if (response.status === 429) {
        context.log.warn(`Rate limited by IPFS gateway`, { cid, endpoint: endpoint.url });
      } else {
        context.log.warn(`IPFS gateway returned error`, {
          cid,
          endpoint: endpoint.url,
          status: response.status,
          statusText: response.statusText
        });
      }
      return null;
    }
  } catch (e) {
    const error = e as Error;
    context.log.warn(`IPFS fetch failed`, {
      cid,
      endpoint: endpoint.url,
      error: error.message,
      errorName: error.name,
      errorStack: error.stack,
      errorCause: error.cause
    });
    return null;
  }
}

// Fetch relationship data (from/to structure)
export const getRelationshipData = experimental_createEffect(
    {
      name: "getRelationshipData",
      input: S.string,
      output: relationshipSchema,
      cache: true,
    },
    async ({ input: cid, context }) => {
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];

        try {
          const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
          context.log.info(`Fetching relationship data from gateway`, { cid, endpoint: endpoint.url });

          const response = await fetch(fullUrl);
          if (response.ok) {
            const data: any = await response.json();
            if (data && data.to && data.to["/"]) {
              context.log.info(`Successfully fetched relationship data`, { cid });
              return data;
            }
          } else {
            context.log.warn(`Relationship data fetch failed - HTTP error`, {
              cid,
              endpoint: endpoint.url,
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (e) {
          const error = e as Error;
          context.log.warn(`Failed to fetch relationship data`, {
            cid,
            endpoint: endpoint.url,
            error: error.message,
            errorName: error.name,
            errorStack: error.stack,
            errorCause: error.cause
          });
        }

        // Delay between endpoints
        if (i < endpoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenEndpoints));
        }
      }

      throw new Error(`Failed to fetch relationship data for CID: ${cid}`);
    }
);

// Fetch structure data (roof_date)
export const getStructureData = experimental_createEffect(
    {
      name: "getStructureData",
      input: S.string,
      output: structureSchema,
      cache: true,
    },
    async ({ input: cid, context }) => {
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];

        try {
          const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
          context.log.info(`Fetching structure data from gateway`, { cid, endpoint: endpoint.url });

          const response = await fetch(fullUrl);
          if (response.ok) {
            const data: any = await response.json();
            if (data && typeof data === 'object') {
              context.log.info(`Successfully fetched structure data`, { cid, roof_date: data.roof_date });
              return {
                // Original field
                roof_date: data.roof_date || undefined,
                // Expanded structure fields (handling null values)
                architectural_style_type: data.architectural_style_type || undefined,
                attachment_type: data.attachment_type || undefined,
                ceiling_condition: data.ceiling_condition || undefined,
                ceiling_height_average: data.ceiling_height_average || undefined,
                ceiling_insulation_type: data.ceiling_insulation_type || undefined,
                ceiling_structure_material: data.ceiling_structure_material || undefined,
                ceiling_surface_material: data.ceiling_surface_material || undefined,
                exterior_door_material: data.exterior_door_material || undefined,
                exterior_wall_condition: data.exterior_wall_condition || undefined,
                exterior_wall_insulation_type: data.exterior_wall_insulation_type || undefined,
                exterior_wall_material_primary: data.exterior_wall_material_primary || undefined,
                exterior_wall_material_secondary: data.exterior_wall_material_secondary || undefined,
                flooring_condition: data.flooring_condition || undefined,
                flooring_material_primary: data.flooring_material_primary || undefined,
                flooring_material_secondary: data.flooring_material_secondary || undefined,
                foundation_condition: data.foundation_condition || undefined,
                foundation_material: data.foundation_material || undefined,
                foundation_type: data.foundation_type || undefined,
                foundation_waterproofing: data.foundation_waterproofing || undefined,
                gutters_condition: data.gutters_condition || undefined,
                gutters_material: data.gutters_material || undefined,
                interior_door_material: data.interior_door_material || undefined,
                interior_wall_condition: data.interior_wall_condition || undefined,
                interior_wall_finish_primary: data.interior_wall_finish_primary || undefined,
                interior_wall_finish_secondary: data.interior_wall_finish_secondary || undefined,
                interior_wall_structure_material: data.interior_wall_structure_material || undefined,
                interior_wall_surface_material_primary: data.interior_wall_surface_material_primary || undefined,
                interior_wall_surface_material_secondary: data.interior_wall_surface_material_secondary || undefined,
                number_of_stories: data.number_of_stories || undefined,
                primary_framing_material: data.primary_framing_material || undefined,
                request_identifier: data.request_identifier || undefined,
                roof_age_years: data.roof_age_years || undefined,
                roof_condition: data.roof_condition || undefined,
                roof_covering_material: data.roof_covering_material || undefined,
                roof_design_type: data.roof_design_type || undefined,
                roof_material_type: data.roof_material_type || undefined,
                roof_structure_material: data.roof_structure_material || undefined,
                roof_underlayment_type: data.roof_underlayment_type || undefined,
                secondary_framing_material: data.secondary_framing_material || undefined,
                structural_damage_indicators: data.structural_damage_indicators || undefined,
                subfloor_material: data.subfloor_material || undefined,
                window_frame_material: data.window_frame_material || undefined,
                window_glazing_type: data.window_glazing_type || undefined,
                window_operation_type: data.window_operation_type || undefined,
                window_screen_material: data.window_screen_material || undefined,
              };
            }
          } else {
            context.log.warn(`Structure data fetch failed - HTTP error`, {
              cid,
              endpoint: endpoint.url,
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (e) {
          const error = e as Error;
          context.log.warn(`Failed to fetch structure data`, {
            cid,
            endpoint: endpoint.url,
            error: error.message,
            errorName: error.name,
            errorStack: error.stack,
            errorCause: error.cause
          });
        }

        // Delay between endpoints
        if (i < endpoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenEndpoints));
        }
      }

      throw new Error(`Failed to fetch structure data for CID: ${cid}`);
    }
);

// Fetch address data
export const getAddressData = experimental_createEffect(
    {
      name: "getAddressData",
      input: S.string,
      output: addressSchema,
      cache: true,
    },
    async ({ input: cid, context }) => {
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];

        try {
          const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
          context.log.info(`Fetching address data from gateway`, { cid, endpoint: endpoint.url });

          const response = await fetch(fullUrl);
          if (response.ok) {
            const data: any = await response.json();
            if (data && typeof data === 'object') {
              context.log.info(`Successfully fetched address data`, {
                cid,
                county_name: data.county_name
              });

              return {
                request_identifier: data.request_identifier || undefined,
                block: data.block || undefined,
                city_name: data.city_name || undefined,
                country_code: data.country_code || undefined,
                county_name: data.county_name || undefined,
                latitude: data.latitude || undefined,
                longitude: data.longitude || undefined,
                lot: data.lot || undefined,
                municipality_name: data.municipality_name || undefined,
                plus_four_postal_code: data.plus_four_postal_code || undefined,
                postal_code: data.postal_code || undefined,
                range: data.range || undefined,
                route_number: data.route_number || undefined,
                section: data.section || undefined,
                state_code: data.state_code || undefined,
                street_name: data.street_name || undefined,
                street_number: data.street_number || undefined,
                street_post_directional_text: data.street_post_directional_text || undefined,
                street_pre_directional_text: data.street_pre_directional_text || undefined,
                street_suffix_type: data.street_suffix_type || undefined,
                township: data.township || undefined,
                unit_identifier: data.unit_identifier || undefined,
              };
            }
          } else {
            context.log.warn(`Address data fetch failed - HTTP error`, {
              cid,
              endpoint: endpoint.url,
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (e) {
          const error = e as Error;
          context.log.warn(`Failed to fetch address data`, {
            cid,
            endpoint: endpoint.url,
            error: error.message,
            errorName: error.name,
            errorStack: error.stack,
            errorCause: error.cause
          });
        }

        // Delay between endpoints
        if (i < endpoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenEndpoints));
        }
      }

      throw new Error(`Failed to fetch address data for CID: ${cid}`);
    }
);

// Fetch property data (property_type, built years)
export const getPropertyData = experimental_createEffect(
    {
      name: "getPropertyData",
      input: S.string,
      output: propertySchema,
      cache: true,
    },
    async ({ input: cid, context }) => {
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];

        try {
          const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
          context.log.info(`Fetching property data from gateway`, { cid, endpoint: endpoint.url });

          const response = await fetch(fullUrl);
          if (response.ok) {
            const data: any = await response.json();
            if (data && typeof data === 'object') {
              context.log.info(`Successfully fetched property data`, {
                cid,
                property_type: data.property_type,
                property_structure_built_year: data.property_structure_built_year,
                property_effective_built_year: data.property_effective_built_year
              });

              return {
                property_type: data.property_type || undefined,
                property_structure_built_year: data.property_structure_built_year ? String(data.property_structure_built_year) : undefined,
                property_effective_built_year: data.property_effective_built_year ? String(data.property_effective_built_year) : undefined,
                parcel_identifier: data.parcel_identifier || undefined,
                area_under_air: data.area_under_air || undefined,
                historic_designation: data.historic_designation || undefined,
                livable_floor_area: data.livable_floor_area || undefined,
                number_of_units: data.number_of_units || undefined,
                number_of_units_type: data.number_of_units_type || undefined,
                property_legal_description_text: data.property_legal_description_text || undefined,
                request_identifier: data.request_identifier || undefined,
                subdivision: data.subdivision || undefined,
                total_area: data.total_area || undefined,
                zoning: data.zoning || undefined,
              };
            }
          } else {
            context.log.warn(`Property data fetch failed - HTTP error`, {
              cid,
              endpoint: endpoint.url,
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (e) {
          const error = e as Error;
          context.log.warn(`Failed to fetch property data`, {
            cid,
            endpoint: endpoint.url,
            error: error.message,
            errorName: error.name,
            errorStack: error.stack,
            errorCause: error.cause
          });
        }

        // Delay between endpoints
        if (i < endpoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenEndpoints));
        }
      }

      throw new Error(`Failed to fetch property data for CID: ${cid}`);
    }
);

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  delayBetweenEndpoints: 2000, // 2 seconds between trying different gateways
  delayOn429: 10000, // 10 seconds when rate limited
  delayOnError: 10000, // 10 seconds on other errors
  maxRetries: 1, // Max retries per endpoint (reduced to avoid too many failures)
};

// Fetch fact sheet data (ipfs_url and full_generation_command)
export const getIpfsFactSheetData = experimental_createEffect(
    {
      name: "getIpfsFactSheetData",
      input: S.string,
      output: ipfsFactSheetSchema,
      cache: true,
    },
    async ({ input: cid, context }) => {
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];

        try {
          const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
          context.log.info(`Fetching fact sheet data from gateway`, { cid, endpoint: endpoint.url });

          const response = await fetch(fullUrl);
          if (response.ok) {
            const data: any = await response.json();
            if (data && typeof data === 'object') {
              context.log.info(`Successfully fetched fact sheet data`, {
                cid,
                ipfs_url: data.ipfs_url
              });

              return {
                ipfs_url: data.ipfs_url || undefined,
                full_generation_command: data.full_generation_command || undefined,
              };
            }
          } else {
            context.log.warn(`Fact sheet data fetch failed - HTTP error`, {
              cid,
              endpoint: endpoint.url,
              status: response.status,
              statusText: response.statusText
            });
          }
        } catch (e) {
          const error = e as Error;
          context.log.warn(`Failed to fetch fact sheet data`, {
            cid,
            endpoint: endpoint.url,
            error: error.message,
            errorName: error.name,
            errorStack: error.stack,
            errorCause: error.cause
          });
        }

        // Delay between endpoints
        if (i < endpoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenEndpoints));
        }
      }

      throw new Error(`Failed to fetch fact sheet data for CID: ${cid}`);
    }
);

export const getIpfsMetadata = experimental_createEffect(
    {
      name: "getIpfsMetadata",
      input: S.string,
      output: ipfsMetadataSchema,
      cache: true, // Enable caching for better performance
    },
    async ({ input: cid, context }) => {
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];

        // Try each endpoint with retries
        for (let retry = 0; retry < RATE_LIMIT_CONFIG.maxRetries; retry++) {
          const metadata = await fetchFromEndpoint(context, endpoint, cid);
          if (metadata) {
            return metadata;
          }

          // Delay before retry (except on last retry of last endpoint)
          if (retry < RATE_LIMIT_CONFIG.maxRetries - 1) {
            const delay = RATE_LIMIT_CONFIG.delayOnError;
            context.log.info(`Retrying endpoint in ${delay}ms`, { endpoint, retry: retry + 1 });
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        // Delay between endpoints (except for last endpoint)
        if (i < endpoints.length - 1) {
          context.log.info(`Trying next endpoint in ${RATE_LIMIT_CONFIG.delayBetweenEndpoints}ms`);
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_CONFIG.delayBetweenEndpoints));
        }
      }

      // All endpoints failed - throw error to prevent corrupted data
      context.log.error("Unable to fetch IPFS metadata from all gateways", { cid });
      throw new Error(`Failed to fetch IPFS content for CID: ${cid}`);
    }
);