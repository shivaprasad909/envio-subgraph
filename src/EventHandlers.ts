/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  ERC1967Proxy,
  ERC1967Proxy_DataGroupHeartBeat,
  ERC1967Proxy_DataSubmitted,
  DataSubmittedWithLabel,
  CountyStats,
} from "generated";

import { bytes32ToCID, getIpfsMetadata } from "./utils/ipfs";
import { processCountyData } from "./utils/eventHelpers";

ERC1967Proxy.DataGroupHeartBeat.handler(async ({ event, context }) => {
  // Process HeartBeat events from all submitters

  const entity: ERC1967Proxy_DataGroupHeartBeat = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    propertyHash: event.params.propertyHash,
    dataGroupHash: event.params.dataGroupHash,
    dataHash: event.params.dataHash,
    submitter: event.params.submitter,
  };

  context.ERC1967Proxy_DataGroupHeartBeat.set(entity);

  // Find existing DataSubmittedWithLabel using same logic as DataSubmitted
  const propertyHash = event.params.propertyHash;
  const currentTimestamp = BigInt(event.block.timestamp);
  const cid = bytes32ToCID(event.params.dataHash);

  try {
    const metadata = await context.effect(getIpfsMetadata, cid);

    // Skip if label is not County
    if (metadata.label !== "County") {
      context.log.info(`Skipping HeartBeat - label is not County`, {
        propertyHash,
        label: metadata.label,
        cid
      });
      return;
    }

    const propertyId = event.params.propertyHash;
    let parcelIdentifier: string | undefined;

    // Process County data to get parcel_identifier
    const result = await processCountyData(context, metadata, cid, propertyId);
    if (result) {
      parcelIdentifier = result.parcelIdentifier;
    }

    // Only use parcel_identifier as property ID - skip if not found
    if (!parcelIdentifier) {
      context.log.info(`Skipping HeartBeat - no parcel_identifier found`, {
        propertyHash,
        cid
      });
      return;
    }

    const mainEntityId = parcelIdentifier;

    // Check if entity exists (try parcel_identifier first, then propertyHash)
    let existingEntity: DataSubmittedWithLabel | undefined;
    if (parcelIdentifier) {
      existingEntity = await context.DataSubmittedWithLabel.get(parcelIdentifier);
    }
    if (!existingEntity) {
      existingEntity = await context.DataSubmittedWithLabel.get(propertyId);
    }

    if (existingEntity) {
      // Update the datetime field
      const updatedEntity: DataSubmittedWithLabel = {
        ...existingEntity,
        datetime: currentTimestamp,
      };

      context.DataSubmittedWithLabel.set(updatedEntity);

      context.log.info(`Updated datetime for property from HeartBeat`, {
        propertyHash,
        entityId: existingEntity.id,
        mainEntityId,
        newDatetime: currentTimestamp.toString(),
      });
    } else {
      context.log.warn(`DataSubmittedWithLabel not found for HeartBeat`, {
        propertyHash,
        mainEntityId,
      });
    }
  } catch (error) {
    context.log.warn(`Failed to update datetime from HeartBeat`, {
      propertyHash,
      cid,
      error: (error as Error).message
    });
  }
});

ERC1967Proxy.DataSubmitted.handler(async ({ event, context }) => {
  // Process DataSubmitted events from all submitters

  const entity: ERC1967Proxy_DataSubmitted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    propertyHash: event.params.propertyHash,
    dataGroupHash: event.params.dataGroupHash,
    submitter: event.params.submitter,
    dataHash: event.params.dataHash,
  };

  context.ERC1967Proxy_DataSubmitted.set(entity);

  const cid = bytes32ToCID(event.params.dataHash);

  try {
    const metadata = await context.effect(getIpfsMetadata, cid);

    // Skip if not County label
    if (metadata.label !== "County") {
      context.log.info(`Skipping DataSubmitted - label is not County`, {
        label: metadata.label,
        cid
      });
      return;
    }

    const propertyId = event.params.propertyHash;
    let parcelIdentifier: string | undefined;
    let addressId: string | undefined;
    let propertyDataId: string | undefined;

    // Process County data to get parcel_identifier
    const result = await processCountyData(context, metadata, cid, propertyId);
    if (result) {
      parcelIdentifier = result.parcelIdentifier;
      addressId = result.addressId;
      propertyDataId = result.propertyDataId;
    }

    // Only use parcel_identifier as property ID - skip if not found
    if (!parcelIdentifier) {
      context.log.info(`Skipping DataSubmitted - no parcel_identifier found`, {
        propertyHash: event.params.propertyHash,
        cid
      });
      return;
    }

    const mainEntityId = parcelIdentifier;

    // Log what entities were created (Property and Address entities are created inside processCountyData)
    if (propertyDataId) {
      context.log.info(`Property entity created`, {
        propertyId: propertyDataId,
        parcelIdentifier
      });
    }

    if (addressId) {
      context.log.info(`Address entity created`, {
        addressId,
        parcelIdentifier
      });
    }

    // Check if DataSubmittedWithLabel entity exists
    let existingEntityDS: DataSubmittedWithLabel | undefined;
    existingEntityDS = await context.DataSubmittedWithLabel.get(parcelIdentifier);

    // Create or update the main DataSubmittedWithLabel entity
    const labelEntity: DataSubmittedWithLabel = {
      id: mainEntityId,
      propertyHash: event.params.propertyHash, // Always update with latest propertyHash
      submitter: event.params.submitter,
      dataHash: event.params.dataHash,
      cid: cid,
      label: metadata.label,
      address_id: addressId,
      property_id: propertyDataId,
      datetime: BigInt(event.block.timestamp),
    };

    context.DataSubmittedWithLabel.set(labelEntity);

    // Update county statistics if this is a new entity and we have address data
    if (!existingEntityDS && addressId) {
      try {
        // Get the address entity to extract county name
        const addressEntity = await context.Address.get(addressId);
        if (addressEntity && addressEntity.county_name) {
          const countyName = addressEntity.county_name;
          const countyStatsId = `county_${countyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

          // Get existing county stats or create new one
          let countyStats = await context.CountyStats.get(countyStatsId);

          if (countyStats) {
            // Increment count for existing county
            const updatedCountyStats: CountyStats = {
              ...countyStats,
              unique_properties_count: countyStats.unique_properties_count + 1,
              last_updated: labelEntity.datetime?.toString() || event.block.timestamp.toString(),
            };
            context.CountyStats.set(updatedCountyStats);
          } else {
            // Create new county stats
            const newCountyStats: CountyStats = {
              id: countyStatsId,
              county_name: countyName,
              unique_properties_count: 1,
              last_updated: labelEntity.datetime?.toString() || event.block.timestamp.toString(),
            };
            context.CountyStats.set(newCountyStats);
          }

          context.log.info(`Updated county statistics`, {
            countyName,
            countyStatsId,
            isNewCounty: !countyStats,
            newCount: countyStats ? countyStats.unique_properties_count + 1 : 1
          });
        }
      } catch (error) {
        context.log.warn(`Failed to update county statistics`, {
          addressId,
          error: (error as Error).message
        });
      }
    }

    context.log.info(`${existingEntityDS ? 'Updated' : 'Created'} DataSubmittedWithLabel entity`, {
      entityId: mainEntityId,
      propertyHash: event.params.propertyHash,
      label: metadata.label,
      addressId,
      propertyDataId,
      isUpdate: !!existingEntityDS,
      datetime: labelEntity.datetime?.toString()
    });
  } catch (error) {
    context.log.warn(`Failed to get metadata for CID`, {
      cid,
      error: (error as Error).message
    });
  }
});