import { S } from "envio";

// IPFS Metadata Schemas
export const ipfsMetadataSchema = S.schema({
  label: S.string,
  relationships: S.optional(S.schema({
    property_has_structure: S.optional(S.schema({
      "/": S.string
    })),
    property_has_address: S.optional(S.schema({
      "/": S.string
    })),
    property_has_lot: S.optional(S.schema({
      "/": S.string
    })),
    property_has_sales_history: S.optional(S.array(S.schema({
      "/": S.string
    }))),
    property_has_tax: S.optional(S.array(S.schema({
      "/": S.string
    }))),
    property_has_utility: S.optional(S.schema({
      "/": S.string
    })),
    property_has_flood_storm_information: S.optional(S.schema({
      "/": S.string
    })),
    person_has_property: S.optional(S.array(S.schema({
      "/": S.string
    }))),
    company_has_property: S.optional(S.array(S.schema({
      "/": S.string
    }))),
    property_has_layout: S.optional(S.array(S.schema({
      "/": S.string
    }))),
    property_has_file: S.optional(S.array(S.schema({
      "/": S.string
    }))),
    deed_has_file: S.optional(S.array(S.schema({
      "/": S.string
    }))),
    property_seed: S.optional(S.schema({
      "/": S.string
    })),
    address_has_fact_sheet: S.optional(S.array(S.schema({
      "/": S.string
    })))
  }))
});

// Relationship Schema
export const relationshipSchema = S.schema({
  from: S.optional(S.schema({
    "/": S.string
  })),
  to: S.schema({
    "/": S.string
  })
});

// Address Data Schema
export const addressSchema = S.schema({
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

// Property Data Schema
export const propertySchema = S.schema({
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


// Inferred Types
export type IpfsMetadata = S.Infer<typeof ipfsMetadataSchema>;
export type RelationshipData = S.Infer<typeof relationshipSchema>;
export type AddressData = S.Infer<typeof addressSchema>;
export type PropertyData = S.Infer<typeof propertySchema>;
