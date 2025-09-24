import { experimental_createEffect, S, type EffectContext } from "envio";
import {
    ipfsMetadataSchema,
    relationshipSchema,
    addressSchema,
    propertySchema,
    type IpfsMetadata,
    type RelationshipData,
    type AddressData,
    type PropertyData,
} from "./schemas";

// Convert bytes32 to CID (same as subgraph implementation)
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

// Build gateway configuration from environment variables only
function buildEndpoints() {
    // Require ENVIO_IPFS_GATEWAY environment variable
    const envGateway = process.env.ENVIO_IPFS_GATEWAY;
    const envToken = process.env.ENVIO_GATEWAY_TOKEN;

    if (!envGateway) {
        throw new Error('ENVIO_IPFS_GATEWAY environment variable is required but not provided');
    }

    // Only use the environment variable gateway
    return [{
        url: envGateway,
        token: envToken || null
    }];
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

