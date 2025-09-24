import {
  Address,
  Property,
} from "generated";
import {getRelationshipData, getAddressData, getPropertyData } from "./ipfs";

// Function to get all wallet addresses from environment variables
export function getAllowedSubmitters(): string[] {
  const wallets: string[] = [];

  // Get all environment variables
  const envVars = process.env;

  // Find all variables that start with ENVIO_WALLET_ADDRESS
  for (const [key, value] of Object.entries(envVars)) {
    if (key.startsWith('ENVIO_WALLET_ADDRESS') && value) {
      wallets.push(value);
    }
  }

  if (wallets.length === 0) {
    throw new Error('CRITICAL: No wallet addresses found in environment variables starting with ENVIO_WALLET_ADDRESS. Indexer cannot proceed without valid wallet addresses.');
  }

  return wallets;
}


// Helper to create Property entity
export function createPropertyEntity(propertyDataId: string, propertyData: any): Property {
  return {
    id: propertyDataId,
    property_type: propertyData.property_type || undefined,
    property_structure_built_year: propertyData.property_structure_built_year || undefined,
    property_effective_built_year: propertyData.property_effective_built_year || undefined,
    parcel_identifier: propertyData.parcel_identifier || undefined,
    area_under_air: propertyData.area_under_air || undefined,
    historic_designation: propertyData.historic_designation || undefined,
    livable_floor_area: propertyData.livable_floor_area || undefined,
    number_of_units: propertyData.number_of_units || undefined,
    number_of_units_type: propertyData.number_of_units_type || undefined,
    property_legal_description_text: propertyData.property_legal_description_text || undefined,
    request_identifier: propertyData.request_identifier || undefined,
    subdivision: propertyData.subdivision || undefined,
    total_area: propertyData.total_area || undefined,
    zoning: propertyData.zoning || undefined
  };
}

// Helper to create Address entity
export function createAddressEntity(addressId: string, addressData: any): Address {
  return {
    id: addressId,
    county_name: addressData.county_name || undefined,
    request_identifier: addressData.request_identifier || undefined,
    block: addressData.block || undefined,
    city_name: addressData.city_name || undefined,
    country_code: addressData.country_code || undefined,
    latitude: addressData.latitude || undefined,
    longitude: addressData.longitude || undefined,
    lot: addressData.lot || undefined,
    municipality_name: addressData.municipality_name || undefined,
    plus_four_postal_code: addressData.plus_four_postal_code || undefined,
    postal_code: addressData.postal_code || undefined,
    range: addressData.range || undefined,
    route_number: addressData.route_number || undefined,
    section: addressData.section || undefined,
    state_code: addressData.state_code || undefined,
    street_direction_prefix: addressData.street_pre_directional_text || undefined,
    street_direction_suffix: addressData.street_post_directional_text || undefined,
    street_name: addressData.street_name || undefined,
    street_number: addressData.street_number || undefined,
    street_suffix: addressData.street_suffix_type || undefined,
    unit_identifier: addressData.unit_identifier || undefined,
    township: addressData.township || undefined
  };
}


// Helper to process County data with full parallelism
export async function processCountyData(context: any, metadata: any, cid: string, propertyEntityId: string) {
  // Initialize entity IDs that will be populated from IPFS data
  let addressId: string | undefined;
  let propertyDataId: string | undefined;
  let parcelIdentifier: string | undefined;

  // First fetch relationships to get CIDs
  const relationshipPromises = [];

  const propertyAddressCid = metadata.relationships?.property_has_address?.["/"];


  if (propertyAddressCid) {
    relationshipPromises.push(
      context.effect(getRelationshipData, propertyAddressCid)
        .then((data: any) => ({ type: 'property_rel', data, cid: propertyAddressCid }))
        .catch((error: any) => ({ type: 'property_rel', error, cid: propertyAddressCid }))
    );
  }

  const relationshipResults = await Promise.all(relationshipPromises);

  // Extract all CIDs for parallel fetching
  const allDataPromises = [];
  let propertyDataCid: string | undefined;
  let addressDataCid: string | undefined;

  for (const relationshipResult of relationshipResults) {
    if (relationshipResult.type === 'property_rel' && !relationshipResult.error) {
      // From property_has_address: get property (from)
      propertyDataCid = relationshipResult.data.from?.["/"];
      addressDataCid = relationshipResult.data.to?.["/"];
    }
  }


  if (propertyDataCid) {
    allDataPromises.push(
      context.effect(getPropertyData, propertyDataCid)
        .then((data: any) => ({ type: 'property', data, cid: propertyDataCid }))
        .catch((error: any) => ({ type: 'property', error, cid: propertyDataCid }))
    );
  }

  if (addressDataCid) {
    allDataPromises.push(
      context.effect(getAddressData, addressDataCid)
        .then((data: any) => ({ type: 'address', data, cid: addressDataCid }))
        .catch((error: any) => ({ type: 'address', error, cid: addressDataCid }))
    );
  }

  // Execute all data fetches in parallel
  const allDataResults = await Promise.all(allDataPromises);

  // Process all results
  for (const result of allDataResults) {
    if (result.error) {
      context.log.warn(`Failed to fetch ${result.type} data`, {
        cid,
        error: result.error.message
      });
      continue;
    }

    if (result.type === 'property') {
      propertyDataId = result.cid;
      const propertyEntity = createPropertyEntity(result.cid, result.data);
      context.Property.set(propertyEntity);

      if (result.data.parcel_identifier) {
        parcelIdentifier = result.data.parcel_identifier;
      }

    } else if (result.type === 'address') {
      addressId = result.cid;
      const addressEntity = createAddressEntity(result.cid, result.data);
      context.Address.set(addressEntity);
    }
  }

  return {
    addressId,
    propertyDataId,
    parcelIdentifier,
  };
}