import { experimental_createEffect, S, type EffectContext } from "envio";
import {
    ipfsMetadataSchema,
    relationshipSchema,
    structureSchema,
    addressSchema,
    propertySchema,
    ipfsFactSheetSchema,
    lotDataSchema,
    salesHistorySchema,
    taxSchema,
    utilitySchema,
    floodStormInformationSchema,
    personSchema,
    companySchema,
    layoutSchema,
    fileSchema,
    deedSchema,
    type IpfsMetadata,
    type RelationshipData,
    type StructureData,
    type AddressData,
    type PropertyData,
    type IpfsFactSheetData,
    type LotData,
    type SalesHistoryData,
    type TaxData,
    type UtilityData,
    type FloodStormInformationData,
    type PersonData,
    type CompanyData,
    type LayoutData,
    type FileData,
    type DeedData
} from "./schemas";

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

// Build gateway configuration with environment variables as priority
function buildEndpoints() {
    const endpoints = [];

    // Check for custom gateway from environment variables (highest priority)
    const envGateway = process.env.ENVIO_IPFS_GATEWAY;
    const envToken = process.env.ENVIO_GATEWAY_TOKEN;

    if (envGateway) {
        endpoints.push({
            url: envGateway,
            token: envToken || null
        });
    }

    // Add fallback gateways
    const fallbackEndpoints = [
        { url: "https://sapphire-academic-leech-250.mypinata.cloud/ipfs", token: "CcV1DorYnAo9eZr_P4DXg8TY4SB-QuUw_b6C70JFs2M8aY0fJudBnle2mUyCYyTu" },
        { url: "https://indexing-node-envio.mypinata.cloud/ipfs", token: "iYp6WBHfIL-yzshn3WnFyCJRmIH3iBqwcD9Jou-pgTmtr20GXaDWXxqTg9zOP6dk" },
        { url: "https://dry-fuchsia-ox.myfilebase.com/ipfs/", token: null },
        { url: "https://indexing-node-envio-2.mypinata.cloud/ipfs", token: "OdQztc-h-6PjCKKJnUvYpjjw_m8n4KsRBMRWOGtyipd-KVRG7rTiC2D5bKKBDA2B" },
        { url: "https://indexing-node-envio-3.mypinata.cloud/ipfs", token: "cSEbVBstzkkTTco4oO-iBbuhX_sahOth00XH2rpE7E30IuwnE6A7gdxSa_ZSfWs6" },
        { url: "https://indexing-node-envio-4.mypinata.cloud/ipfs", token: "BZA3Pmr1XNG7HqS49-owAGq0UcHxEmSBBK58-VTN4XeY3cP0DeUFXdhuo6z8sFfk" },
        { url: "https://indexing-node-envio-5.mypinata.cloud/ipfs", token: "oe6OopKUwS21PFia0i9o9fJIjPp5lFcosrcW6r1NTCh5BNEylK6blp0JQyFf5Qf3" },
        { url: "https://indexing-node-envio-6.mypinata.cloud/ipfs", token: "WXB6rg3NUOUf4RJqZ92mphaJzui37iTm5KnYdINfEViuecA7Pi5NZnbmWv1JLO0o" },
        { url: "https://indexing-node-envio-7.mypinata.cloud/ipfs", token: "mENdB9KWRja3LKxHuPM9ALFnpDeIq3hKO2kkmDNyAVL7lwSpEnIjoEe6CKQHoE_c" },
        { url: "https://indexing-node-envio-8.mypinata.cloud/ipfs", token: "cI2sPS-C2G5O1jhDSGGIS0wrxKbLg7EvOSbgXuKbaR0JL7U1PMtp-bqg6i2enIaw" },
        { url: "https://indexing-node-envio-9.mypinata.cloud/ipfs", token: "90TLB7uLlOGodY8BWEmJa47nWKoru1Bd54yZQcbPrp6GJOG3-SAayrGHi6wfiXry" },
        { url: "https://indexing-node-envio-10.mypinata.cloud/ipfs", token: "XZ5G02AF45h_a8Fvv4S5HR9LthJ5y27S2xAMivgfW002aVr2bhK5XqflTc_QWk02" },        { url: "https://moral-aqua-catfish.myfilebase.com/ipfs", token: null },
        { url: "https://bronze-blank-cod-736.mypinata.cloud/ipfs", token: "0EicEGVVMxNrYgog3s1-Aud_3v32eSvF9nYypTkQ4Qy-G4M8N-zdBvL1DNYjlupe" },
        { url: "https://indexing2.myfilebase.com/ipfs", token: null },
        { url: "https://ipfs.io/ipfs", token: null },
        { url: "https://gateway.ipfs.io/ipfs", token: null },
        { url: "https://dweb.link/ipfs", token: null },
        { url: "https://w3s.link/ipfs", token: null },
        { url: "https://gateway.pinata.cloud/ipfs", token: null },
    ];

    // Add fallback endpoints, avoiding duplicates
    for (const fallback of fallbackEndpoints) {
        const isDuplicate = endpoints.some(existing => existing.url === fallback.url);
        if (!isDuplicate) {
            endpoints.push(fallback);
        }
    }

    return endpoints;
}

// Gateway configuration with optional authentication tokens
const endpoints = buildEndpoints();

// Helper function to build URL with optional token
function buildGatewayUrl(baseUrl: string, cid: string, token: string | null): string {
    const url = `${baseUrl}/${cid}`;
    if (token) {
        return `${url}?pinataGatewayToken=${token}`;
    }
    return url;
}

// Helper function to check if error should trigger retry (connection errors, timeouts, rate limits)
function shouldRetryIndefinitely(response?: Response, error?: Error): boolean {
    // Retry indefinitely on connection/timeout errors
    if (error?.name === 'ConnectTimeoutError' ||
        error?.name === 'TypeError' ||
        error?.name === 'FetchError' ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('ENOTFOUND') ||
        error?.message?.includes('ETIMEDOUT') ||
        error?.message?.includes('fetch failed')) {
        return true;
    }

    // Also check the underlying error cause for connection issues
    const cause = (error as any)?.cause;
    if (cause?.name === 'ConnectTimeoutError' ||
        cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        cause?.message?.includes('Connect Timeout Error') ||
        cause?.message?.includes('timeout')) {
        return true;
    }

    // Retry indefinitely on specific HTTP status codes
    if (response) {
        return response.status === 429 || response.status === 502 || response.status === 504;
    }

    return false;
}

// Helper function for other non-retriable errors (give up after few attempts)
function shouldRetryLimited(response?: Response, error?: Error): boolean {
    if (response) {
        return response.status >= 500 && response.status !== 502 && response.status !== 504;
    }
    return false;
}

// Helper function to wait with exponential backoff
async function waitWithBackoff(attempt: number): Promise<void> {
    const baseDelay = 1000; // 1 second
    const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
}

// New infinite retry function for IPFS data fetching that never gives up on connection errors
async function fetchDataWithInfiniteRetry<T>(
    context: EffectContext,
    cid: string,
    dataType: string,
    validator: (data: any) => boolean,
    transformer: (data: any) => T
): Promise<T> {
    let totalAttempts = 0;

    while (true) {
        for (let i = 0; i < endpoints.length; i++) {
            const endpoint = endpoints[i];
            totalAttempts++;

            try {
                const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
                context.log.info(`Fetching ${fullUrl}`, {
                    cid,
                    endpoint: endpoint.url,
                    attempt: totalAttempts
                })
                const response = await fetch(fullUrl);

                if (response.ok) {
                    const data: any = await response.json();
                    if (validator(data)) {
                        if (totalAttempts > 1) {
                            context.log.info(`${dataType} fetch succeeded after ${totalAttempts} attempts`, {
                                cid,
                                endpoint: endpoint.url,
                                totalAttempts
                            });
                        }
                        return transformer(data);
                    } else {
                        context.log.warn(`${dataType} validation failed`, {
                            cid,
                            endpoint: endpoint.url,
                            attempt: totalAttempts
                        });
                    }
                } else {
                    // Check if we should retry indefinitely
                    if (shouldRetryIndefinitely(response)) {
                        context.log.warn(`${dataType} fetch failed with retriable error, will retry indefinitely`, {
                            cid,
                            endpoint: endpoint.url,
                            status: response.status,
                            statusText: response.statusText,
                            attempt: totalAttempts
                        });
                    } else {
                        context.log.warn(`${dataType} fetch failed with non-retriable error`, {
                            cid,
                            endpoint: endpoint.url,
                            status: response.status,
                            statusText: response.statusText,
                            attempt: totalAttempts
                        });
                    }
                }
            } catch (e) {
                const error = e as Error;
                const cause = (error as any)?.cause;

                // Extract detailed error information
                const errorDetails = {
                    cid,
                    endpoint: endpoint.url,
                    error: error.message,
                    errorName: error.name,
                    attempt: totalAttempts,
                    fullUrl: buildGatewayUrl(endpoint.url, cid, endpoint.token),
                    errorStack: error.stack,
                    errorCause: cause,
                    // Additional diagnostic info
                    causeCode: cause?.code,
                    causeErrno: cause?.errno,
                    causeSystemCall: cause?.syscall,
                    causeAddress: cause?.address,
                    causePort: cause?.port,
                    userAgent: 'Envio-Indexer/1.0',
                    timestamp: new Date().toISOString(),
                    // Network diagnostic hints
                    possibleCause: error.message?.includes('ENOTFOUND') ? 'DNS_RESOLUTION_FAILED' :
                                 error.message?.includes('ECONNREFUSED') ? 'CONNECTION_REFUSED' :
                                 error.message?.includes('ETIMEDOUT') ? 'CONNECTION_TIMEOUT' :
                                 error.message?.includes('ECONNRESET') ? 'CONNECTION_RESET' :
                                 error.message?.includes('timeout') ? 'TIMEOUT' :
                                 error.name === 'AbortError' ? 'REQUEST_ABORTED' :
                                 'UNKNOWN_NETWORK_ERROR'
                };

                if (shouldRetryIndefinitely(undefined, error)) {
                    context.log.warn(`${dataType} fetch failed with retriable connection error, will retry indefinitely`, errorDetails);
                } else {
                    context.log.error(`${dataType} fetch failed with non-retriable error`, {
                        ...errorDetails,
                        errorStringified: JSON.stringify(error, Object.getOwnPropertyNames(error))
                    });
                }
            }

            // No delay between gateways - try them as fast as possible
        }

        // After trying all endpoints, wait a short time before starting another full cycle
        context.log.info(`Completed full gateway cycle (${totalAttempts} attempts), waiting before retry`, {
            cid,
            dataType,
            totalAttempts
        });
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay between full cycles
    }
}

// Helper function specifically for IPFS metadata with infinite retry
async function fetchIpfsMetadataWithInfiniteRetry(
    context: EffectContext,
    cid: string
): Promise<IpfsMetadata> {
    return fetchDataWithInfiniteRetry(
        context,
        cid,
        "IPFS metadata",
        (data) => data && typeof data === 'object' && data.label && typeof data.label === 'string',
        (data) => ({
            label: data.label,
            relationships: data.relationships
        })
    );
}

// DEPRECATED: This function has been replaced by fetchDataWithInfiniteRetry
// Keeping only for getRelationshipData which needs limited retries
async function fetchDataWithLimitedRetry<T>(
    context: EffectContext,
    cid: string,
    dataType: string,
    validator: (data: any) => boolean,
    transformer: (data: any) => T,
    maxAttempts: number = 3
): Promise<T> {
    for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const fullUrl = buildGatewayUrl(endpoint.url, cid, endpoint.token);
                const response = await fetch(fullUrl);

                if (response.ok) {
                    const data: any = await response.json();
                    if (validator(data)) {
                        if (attempt > 0) {
                            context.log.info(`${dataType} fetch succeeded on attempt ${attempt + 1}`, {
                                cid,
                                endpoint: endpoint.url
                            });
                        }
                        return transformer(data);
                    }
                } else {
                    context.log.warn(`${dataType} fetch failed - HTTP error`, {
                        cid,
                        endpoint: endpoint.url,
                        status: response.status,
                        statusText: response.statusText,
                        attempt: attempt + 1,
                        maxAttempts
                    });
                }
            } catch (e) {
                const error = e as Error;
                context.log.warn(`Failed to fetch ${dataType}`, {
                    cid,
                    endpoint: endpoint.url,
                    error: error.message,
                    errorName: error.name,
                    attempt: attempt + 1,
                    maxAttempts
                });
            }

            // Wait before retry (except on last attempt)
            if (attempt < maxAttempts - 1) {
                await waitWithBackoff(attempt);
            }
        }

        // No delay between endpoints - try them as fast as possible
    }

    context.log.error(`Unable to fetch ${dataType} from all gateways`, { cid });
    throw new Error(`Failed to fetch ${dataType} for CID: ${cid}`);
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
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "relationship data",
            (data: any) => data && data.to && data.to["/"],
            (data: any) => data
        );
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
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "structure data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                roof_date: data.roof_date || undefined,
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
            })
        );
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
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "address data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
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
            })
        );
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
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "property data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
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
            })
        );
    }
);


// Fetch fact sheet data (ipfs_url and full_generation_command)
export const getIpfsFactSheetData = experimental_createEffect(
    {
        name: "getIpfsFactSheetData",
        input: S.string,
        output: ipfsFactSheetSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "fact sheet data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                ipfs_url: data.ipfs_url || undefined,
                full_generation_command: data.full_generation_command || undefined,
            })
        );
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
        return fetchIpfsMetadataWithInfiniteRetry(context, cid);
    }
);


export const getLotData = experimental_createEffect(
    {
        name: "getLotData",
        input: S.string,
        output: lotDataSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "lot data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                driveway_condition: data.driveway_condition || undefined,
                driveway_material: data.driveway_material || undefined,
                fence_height: data.fence_height || undefined,
                fence_length: data.fence_length || undefined,
                fencing_type: data.fencing_type || undefined,
                landscaping_features: data.landscaping_features || undefined,
                lot_area_sqft: data.lot_area_sqft || undefined,
                lot_condition_issues: data.lot_condition_issues || undefined,
                lot_length_feet: data.lot_length_feet || undefined,
                lot_size_acre: data.lot_size_acre || undefined,
                lot_type: data.lot_type || undefined,
                lot_width_feet: data.lot_width_feet || undefined,
                request_identifier: data.request_identifier || undefined,
                view: data.view || undefined,
            })
        );
    }
);

export const getSalesHistoryData = experimental_createEffect(
    {
        name: "getSalesHistoryData",
        input: S.string,
        output: salesHistorySchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "sales history data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                ownership_transfer_date: data.ownership_transfer_date || undefined,
                purchase_price_amount: data.purchase_price_amount || undefined,
                request_identifier: data.request_identifier || undefined,
                sale_type: data.sale_type || undefined,
            })
        );
    }
);

export const getTaxData = experimental_createEffect(
    {
        name: "getTaxData",
        input: S.string,
        output: taxSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "tax data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                first_year_building_on_tax_roll: data.first_year_building_on_tax_roll || undefined,
                first_year_on_tax_roll: data.first_year_on_tax_roll || undefined,
                monthly_tax_amount: data.monthly_tax_amount || undefined,
                period_end_date: data.period_end_date || undefined,
                period_start_date: data.period_start_date || undefined,
                property_assessed_value_amount: data.property_assessed_value_amount,
                property_building_amount: data.property_building_amount || undefined,
                property_land_amount: data.property_land_amount || undefined,
                property_market_value_amount: data.property_market_value_amount,
                property_taxable_value_amount: data.property_taxable_value_amount,
                request_identifier: data.request_identifier || undefined,
                tax_year: data.tax_year || undefined,
                yearly_tax_amount: data.yearly_tax_amount || undefined,
            })
        );
    }
);

export const getUtilityData = experimental_createEffect(
    {
        name: "getUtilityData",
        input: S.string,
        output: utilitySchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "utility data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                cooling_system_type: data.cooling_system_type || undefined,
                electrical_panel_capacity: data.electrical_panel_capacity || undefined,
                electrical_wiring_type: data.electrical_wiring_type || undefined,
                electrical_wiring_type_other_description: data.electrical_wiring_type_other_description || undefined,
                heating_system_type: data.heating_system_type || undefined,
                hvac_condensing_unit_present: data.hvac_condensing_unit_present || undefined,
                hvac_unit_condition: data.hvac_unit_condition || undefined,
                hvac_unit_issues: data.hvac_unit_issues || undefined,
                plumbing_system_type: data.plumbing_system_type || undefined,
                plumbing_system_type_other_description: data.plumbing_system_type_other_description || undefined,
                public_utility_type: data.public_utility_type || undefined,
                request_identifier: data.request_identifier || undefined,
                sewer_type: data.sewer_type || undefined,
                smart_home_features: data.smart_home_features || undefined,
                smart_home_features_other_description: data.smart_home_features_other_description || undefined,
                solar_inverter_visible: data.solar_inverter_visible || undefined,
                solar_panel_present: data.solar_panel_present || undefined,
                solar_panel_type: data.solar_panel_type || undefined,
                solar_panel_type_other_description: data.solar_panel_type_other_description || undefined,
                water_source_type: data.water_source_type || undefined,
            })
        );
    }
);

export const getFloodStormData = experimental_createEffect(
    {
        name: "getFloodStormData",
        input: S.string,
        output: floodStormInformationSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "flood storm data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                community_id: data.community_id || undefined,
                effective_date: data.effective_date || undefined,
                evacuation_zone: data.evacuation_zone || undefined,
                fema_search_url: data.fema_search_url || undefined,
                flood_insurance_required: data.flood_insurance_required || undefined,
                flood_zone: data.flood_zone || undefined,
                map_version: data.map_version || undefined,
                panel_number: data.panel_number || undefined,
                request_identifier: data.request_identifier || undefined,
            })
        );
    }
);

export const getPersonData = experimental_createEffect(
    {
        name: "getPersonData",
        input: S.string,
        output: personSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "person data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                birth_date: data.birth_date || undefined,
                first_name: data.first_name,
                last_name: data.last_name,
                middle_name: data.middle_name || undefined,
                prefix_name: data.prefix_name || undefined,
                request_identifier: data.request_identifier || undefined,
                suffix_name: data.suffix_name || undefined,
                us_citizenship_status: data.us_citizenship_status || undefined,
                veteran_status: data.veteran_status || undefined,
            })
        );
    }
);

export const getCompanyData = experimental_createEffect(
    {
        name: "getCompanyData",
        input: S.string,
        output: companySchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "company data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                name: data.name || undefined,
                request_identifier: data.request_identifier || undefined,
            })
        );
    }
);

export const getLayoutData = experimental_createEffect(
    {
        name: "getLayoutData",
        input: S.string,
        output: layoutSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "layout data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                cabinet_style: data.cabinet_style || undefined,
                clutter_level: data.clutter_level || undefined,
                condition_issues: data.condition_issues || undefined,
                countertop_material: data.countertop_material || undefined,
                decor_elements: data.decor_elements || undefined,
                design_style: data.design_style || undefined,
                fixture_finish_quality: data.fixture_finish_quality || undefined,
                floor_level: data.floor_level || undefined,
                flooring_material_type: data.flooring_material_type || undefined,
                flooring_wear: data.flooring_wear || undefined,
                furnished: data.furnished || undefined,
                has_windows: data.has_windows || undefined,
                is_exterior: data.is_exterior,
                is_finished: data.is_finished,
                lighting_features: data.lighting_features || undefined,
                natural_light_quality: data.natural_light_quality || undefined,
                paint_condition: data.paint_condition || undefined,
                pool_condition: data.pool_condition || undefined,
                pool_equipment: data.pool_equipment || undefined,
                pool_surface_type: data.pool_surface_type || undefined,
                pool_type: data.pool_type || undefined,
                pool_water_quality: data.pool_water_quality || undefined,
                request_identifier: data.request_identifier || undefined,
                safety_features: data.safety_features || undefined,
                size_square_feet: data.size_square_feet || undefined,
                spa_type: data.spa_type || undefined,
                space_index: data.space_index,
                space_type: data.space_type || undefined,
                view_type: data.view_type || undefined,
                visible_damage: data.visible_damage || undefined,
                window_design_type: data.window_design_type || undefined,
                window_material_type: data.window_material_type || undefined,
                window_treatment_type: data.window_treatment_type || undefined,
            })
        );
    }
);

export const getFileData = experimental_createEffect(
    {
        name: "getFileData",
        input: S.string,
        output: fileSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "file data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                document_type: data.document_type || undefined,
                file_format: data.file_format || undefined,
                ipfs_url: data.ipfs_url || undefined,
                name: data.name || undefined,
                original_url: data.original_url || undefined,
                request_identifier: data.request_identifier || undefined,
            })
        );
    }
);

export const getDeedData = experimental_createEffect(
    {
        name: "getDeedData",
        input: S.string,
        output: deedSchema,
        cache: true,
    },
    async ({ input: cid, context }) => {
        return fetchDataWithInfiniteRetry(
            context,
            cid,
            "deed data",
            (data: any) => data && typeof data === 'object',
            (data: any) => ({
                deed_type: data.deed_type,
            })
        );
    }
);