/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  ERC1967Proxy,
  ERC1967Proxy_DataGroupConsensusUpdated,
  ERC1967Proxy_DataGroupHeartBeat,
  ERC1967Proxy_DataSubmitted,
  ERC1967Proxy_Initialized,
  ERC1967Proxy_MinimumConsensusUpdated,
  ERC1967Proxy_RoleAdminChanged,
  ERC1967Proxy_RoleGranted,
  ERC1967Proxy_RoleRevoked,
  ERC1967Proxy_Upgraded,
  DataSubmittedWithLabel,
  Structure,
  Address,
  Property,
  Ipfs,
} from "generated";

import { bytes32ToCID, getIpfsMetadata, getPropertyData } from "./utils/ipfs";
import { getAllowedSubmitters, processCountyData } from "./utils/eventHelpers";

// Get allowed submitters from environment variables - this will crash if none found
const allowedSubmitters = getAllowedSubmitters();

ERC1967Proxy.DataGroupConsensusUpdated.handler(async ({ event, context }) => {
  const entity: ERC1967Proxy_DataGroupConsensusUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    dataGroupHash: event.params.dataGroupHash,
    oldValue: event.params.oldValue,
    newValue: event.params.newValue,
  };

  context.ERC1967Proxy_DataGroupConsensusUpdated.set(entity);


});

ERC1967Proxy.DataGroupHeartBeat.handler(async ({ event, context }) => {
  if (!allowedSubmitters.includes(event.params.submitter)) {
    // Skipping HeartBeat event - only processing events from specific submitters
    return;
  }

  const entity: ERC1967Proxy_DataGroupHeartBeat = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    propertyHash: event.params.propertyHash,
    dataGroupHash: event.params.dataGroupHash,
    dataHash: event.params.dataHash,
    submitter: event.params.submitter,
  };

  context.ERC1967Proxy_DataGroupHeartBeat.set(entity);

  const cid = bytes32ToCID(event.params.dataHash);

  try {
    const metadata = await context.effect(getIpfsMetadata, cid);

    // Use propertyHash as the unique ID for the property
    const propertyId = event.params.propertyHash;
    let parcelIdentifier: string | undefined;

    // Initialize entity IDs that will be populated from IPFS data
    let structureId: string | undefined;
    let addressId: string | undefined;
    let propertyDataId: string | undefined;
    let ipfsId: string | undefined;
    let lotId: string | undefined;
    let utilityId: string | undefined;
    let floodStormId: string | undefined;

    if (metadata.label === "County") {
      // Process County data first to get parcel_identifier
      const result = await processCountyData(context, metadata, cid, propertyId);
      structureId = result.structureId;
      addressId = result.addressId;
      propertyDataId = result.propertyDataId;
      ipfsId = result.ipfsId;
      lotId = result.lotId;
      utilityId = result.utilityId;
      floodStormId = result.floodStormId;
      parcelIdentifier = result.parcelIdentifier;

      // Use parcel_identifier as the main entity ID, fallback to propertyHash
      const mainEntityId = parcelIdentifier || propertyId;

      // Re-process sales history with correct mainEntityId if parcelIdentifier exists
      if (parcelIdentifier && parcelIdentifier !== propertyId) {
        // Need to update sales history entities with correct property_id
        for (const salesEntity of result.salesHistoryEntities) {
          const updatedSalesEntity = {
            ...salesEntity,
            property_id: mainEntityId
          };
          context.SalesHistory.set(updatedSalesEntity);
        }

        // Need to update tax entities with correct property_id
        for (const taxEntity of result.taxEntities) {
          const updatedTaxEntity = {
            ...taxEntity,
            property_id: mainEntityId
          };
          context.Tax.set(updatedTaxEntity);
        }

        // Need to update person entities with correct property_id
        for (const personEntity of result.personEntities) {
          const updatedPersonEntity = {
            ...personEntity,
            property_id: mainEntityId
          };
          context.Person.set(updatedPersonEntity);
        }

        // Need to update company entities with correct property_id
        for (const companyEntity of result.companyEntities) {
          const updatedCompanyEntity = {
            ...companyEntity,
            property_id: mainEntityId
          };
          context.Company.set(updatedCompanyEntity);
        }

        // Need to update layout entities with correct property_id
        for (const layoutEntity of result.layoutEntities) {
          const updatedLayoutEntity = {
            ...layoutEntity,
            property_id: mainEntityId
          };
          context.Layout.set(updatedLayoutEntity);
        }

        // Need to update file entities with correct property_id
        for (const fileEntity of result.fileEntities) {
          const updatedFileEntity = {
            ...fileEntity,
            property_id: mainEntityId
          };
          context.File.set(updatedFileEntity);
        }
      }

    } else if (metadata.label === "Seed") {
      // Skip Seed processing - only process County labels
      return;
    }

    // Use parcel_identifier as the main entity ID, fallback to propertyHash
    const mainEntityId = parcelIdentifier || propertyId;
    const idSource = parcelIdentifier ? "parcel_identifier" : "propertyHash";

    // Check if entity exists (try parcel_identifier first, then propertyHash)
    let existingEntity: DataSubmittedWithLabel | undefined;
    if (parcelIdentifier) {
      existingEntity = await context.DataSubmittedWithLabel.get(parcelIdentifier);
    }
    if (!existingEntity) {
      existingEntity = await context.DataSubmittedWithLabel.get(propertyId);
    }

    // Update or create the main property entity
    const labelEntity: DataSubmittedWithLabel = {
      id: mainEntityId,
      propertyHash: event.params.propertyHash, // Always update with latest propertyHash
      submitter: event.params.submitter,
      dataHash: event.params.dataHash,
      cid: cid,
      label: metadata.label,
      id_source: idSource,
      structure_id: structureId,
      address_id: addressId,
      property_id: propertyDataId,
      ipfs_id: ipfsId,
      lot_id: lotId,
      utility_id: utilityId,
      flood_storm_information_id: floodStormId,
    };

    context.DataSubmittedWithLabel.set(labelEntity);
    context.log.info(`${existingEntity ? 'Updated' : 'Created'} property entity from HeartBeat`, {
      entityId: mainEntityId,
      propertyHash: event.params.propertyHash,
      label: metadata.label,
      idSource,
      structureId,
      addressId,
      propertyDataId,
      isUpdate: !!existingEntity
    });
  } catch (error) {
    context.log.warn(`Failed to get metadata for CID from HeartBeat`, {
      cid,
      error: (error as Error).message
    });
  }
});

ERC1967Proxy.DataSubmitted.handler(async ({ event, context }) => {
  if (!allowedSubmitters.includes(event.params.submitter)) {
    // Skipping HeartBeat event - only processing events from specific submitters
    return;
  }

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

    // Use propertyHash as the unique ID for the property
    const propertyId = event.params.propertyHash;
    let parcelIdentifier: string | undefined;

    // Initialize entity IDs that will be populated from IPFS data
    let structureId: string | undefined;
    let addressId: string | undefined;
    let propertyDataId: string | undefined;
    let ipfsId: string | undefined;
    let lotId: string | undefined;
    let utilityId: string | undefined;
    let floodStormId: string | undefined;

    if (metadata.label === "County") {
      // Process County data first to get parcel_identifier
      const result = await processCountyData(context, metadata, cid, propertyId);
      structureId = result.structureId;
      addressId = result.addressId;
      propertyDataId = result.propertyDataId;
      ipfsId = result.ipfsId;
      lotId = result.lotId;
      utilityId = result.utilityId;
      floodStormId = result.floodStormId;
      parcelIdentifier = result.parcelIdentifier;

      // Use parcel_identifier as the main entity ID, fallback to propertyHash
      const mainEntityId = parcelIdentifier || propertyId;

      // Re-process sales history with correct mainEntityId if parcelIdentifier exists
      if (parcelIdentifier && parcelIdentifier !== propertyId) {
        // Need to update sales history entities with correct property_id
        for (const salesEntity of result.salesHistoryEntities) {
          const updatedSalesEntity = {
            ...salesEntity,
            property_id: mainEntityId
          };
          context.SalesHistory.set(updatedSalesEntity);
        }

        // Need to update tax entities with correct property_id
        for (const taxEntity of result.taxEntities) {
          const updatedTaxEntity = {
            ...taxEntity,
            property_id: mainEntityId
          };
          context.Tax.set(updatedTaxEntity);
        }

        // Need to update person entities with correct property_id
        for (const personEntity of result.personEntities) {
          const updatedPersonEntity = {
            ...personEntity,
            property_id: mainEntityId
          };
          context.Person.set(updatedPersonEntity);
        }

        // Need to update company entities with correct property_id
        for (const companyEntity of result.companyEntities) {
          const updatedCompanyEntity = {
            ...companyEntity,
            property_id: mainEntityId
          };
          context.Company.set(updatedCompanyEntity);
        }

        // Need to update layout entities with correct property_id
        for (const layoutEntity of result.layoutEntities) {
          const updatedLayoutEntity = {
            ...layoutEntity,
            property_id: mainEntityId
          };
          context.Layout.set(updatedLayoutEntity);
        }

        // Need to update file entities with correct property_id
        for (const fileEntity of result.fileEntities) {
          const updatedFileEntity = {
            ...fileEntity,
            property_id: mainEntityId
          };
          context.File.set(updatedFileEntity);
        }
      }

    } else if (metadata.label === "Seed") {
      // Skip Seed processing - only process County labels
      return;
    }

    // Use parcel_identifier as the main entity ID, fallback to propertyHash
    const mainEntityId = parcelIdentifier || propertyId;
    const idSource = parcelIdentifier ? "parcel_identifier" : "propertyHash";

    // Check if entity exists (try parcel_identifier first, then propertyHash)
    let existingEntityDS: DataSubmittedWithLabel | undefined;
    if (parcelIdentifier) {
      existingEntityDS = await context.DataSubmittedWithLabel.get(parcelIdentifier);
    }
    if (!existingEntityDS) {
      existingEntityDS = await context.DataSubmittedWithLabel.get(propertyId);
    }

    // Update or create the main property entity
    const labelEntity: DataSubmittedWithLabel = {
      id: mainEntityId,
      propertyHash: event.params.propertyHash, // Always update with latest propertyHash
      submitter: event.params.submitter,
      dataHash: event.params.dataHash,
      cid: cid,
      label: metadata.label,
      id_source: idSource,
      structure_id: structureId,
      address_id: addressId,
      property_id: propertyDataId,
      ipfs_id: ipfsId,
      lot_id: lotId,
      utility_id: utilityId,
      flood_storm_information_id: floodStormId,
    };

    context.DataSubmittedWithLabel.set(labelEntity);
    context.log.info(`${existingEntityDS ? 'Updated' : 'Created'} property entity`, {
      entityId: mainEntityId,
      propertyHash: event.params.propertyHash,
      label: metadata.label,
      idSource,
      structureId,
      addressId,
      propertyDataId,
      isUpdate: !!existingEntityDS
    });
  } catch (error) {
    context.log.warn(`Failed to get metadata for CID`, {
      cid,
      error: (error as Error).message
    });
  }
});

ERC1967Proxy.Initialized.handler(async ({ event, context }) => {
  const entity: ERC1967Proxy_Initialized = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    version: event.params.version,
  };

  context.ERC1967Proxy_Initialized.set(entity);
});

ERC1967Proxy.MinimumConsensusUpdated.handler(async ({ event, context }) => {
  const entity: ERC1967Proxy_MinimumConsensusUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    oldValue: event.params.oldValue,
    newValue: event.params.newValue,
  };

  context.ERC1967Proxy_MinimumConsensusUpdated.set(entity);
});

ERC1967Proxy.RoleAdminChanged.handler(async ({ event, context }) => {
  const entity: ERC1967Proxy_RoleAdminChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    role: event.params.role,
    previousAdminRole: event.params.previousAdminRole,
    newAdminRole: event.params.newAdminRole,
  };

  context.ERC1967Proxy_RoleAdminChanged.set(entity);
});

ERC1967Proxy.RoleGranted.handler(async ({ event, context }) => {
  const entity: ERC1967Proxy_RoleGranted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
  };

  context.ERC1967Proxy_RoleGranted.set(entity);
});

ERC1967Proxy.RoleRevoked.handler(async ({ event, context }) => {
  const entity: ERC1967Proxy_RoleRevoked = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    role: event.params.role,
    account: event.params.account,
    sender: event.params.sender,
  };

  context.ERC1967Proxy_RoleRevoked.set(entity);
});

ERC1967Proxy.Upgraded.handler(async ({ event, context }) => {
  const entity: ERC1967Proxy_Upgraded = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    implementation: event.params.implementation,
  };

  context.ERC1967Proxy_Upgraded.set(entity);
});
// trigger deployment