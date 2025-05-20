// graphql/src/utils/mockData.js
/**
 * Mock FHIR data for development
 */

// Nurses (FHIR Practitioners)
const mockNurses = [
  {
    resourceType: "Practitioner",
    id: "nurse-1",
    meta: {
      tag: [
        {
          system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
          code: "nurse",
        },
      ],
    },
    active: true,
    name: [
      {
        use: "official",
        family: "Smith",
        given: ["Jane"],
        prefix: ["RN"],
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "512-555-1234",
        use: "work",
      },
      {
        system: "email",
        value: "jane.smith@example.com",
        use: "work",
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0360",
              code: "RN",
              display: "Registered Nurse",
            },
          ],
          text: "Registered Nurse",
        },
        period: {
          start: "2010-01-01",
        },
      },
      {
        code: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0360",
              code: "SPEC",
              display: "Specialty",
            },
          ],
          text: "Cardiology",
        },
      },
    ],
  },
  {
    resourceType: "Practitioner",
    id: "nurse-2",
    meta: {
      tag: [
        {
          system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
          code: "nurse",
        },
      ],
    },
    active: true,
    name: [
      {
        use: "official",
        family: "Doe",
        given: ["John"],
        prefix: ["RN"],
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "512-555-5678",
        use: "work",
      },
      {
        system: "email",
        value: "john.doe@example.com",
        use: "work",
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0360",
              code: "RN",
              display: "Registered Nurse",
            },
          ],
          text: "Registered Nurse",
        },
      },
      {
        code: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0360",
              code: "SPEC",
              display: "Specialty",
            },
          ],
          text: "Geriatrics",
        },
      },
    ],
  },
  {
    resourceType: "Practitioner",
    id: "nurse-3",
    meta: {
      tag: [
        {
          system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
          code: "nurse",
        },
      ],
    },
    active: true,
    name: [
      {
        use: "official",
        family: "Johnson",
        given: ["Sarah"],
        prefix: ["RN"],
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "512-555-9012",
        use: "work",
      },
      {
        system: "email",
        value: "sarah.johnson@example.com",
        use: "work",
      },
    ],
    qualification: [
      {
        code: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0360",
              code: "RN",
              display: "Registered Nurse",
            },
          ],
          text: "Registered Nurse",
        },
      },
      {
        code: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0360",
              code: "SPEC",
              display: "Specialty",
            },
          ],
          text: "Pediatrics",
        },
      },
    ],
  },
];

// Nurse locations (FHIR Locations)
const mockNurseLocations = [
  {
    resourceType: "Location",
    id: "location-nurse-1",
    status: "active",
    name: "Jane Smith Office",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: "HOSP",
          display: "Hospital",
        },
      ],
    },
    telecom: [
      {
        system: "phone",
        value: "512-555-1234",
      },
    ],
    address: {
      use: "work",
      type: "both",
      text: "123 Main St, Austin, TX 78701",
      line: ["123 Main St"],
      city: "Austin",
      state: "TX",
      postalCode: "78701",
    },
    position: {
      latitude: 30.2747,
      longitude: -97.7404,
    },
  },
  {
    resourceType: "Location",
    id: "location-nurse-2",
    status: "active",
    name: "John Doe Office",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: "HOSP",
          display: "Hospital",
        },
      ],
    },
    telecom: [
      {
        system: "phone",
        value: "512-555-5678",
      },
    ],
    address: {
      use: "work",
      type: "both",
      text: "456 Oak St, Austin, TX 78704",
      line: ["456 Oak St"],
      city: "Austin",
      state: "TX",
      postalCode: "78704",
    },
    position: {
      latitude: 30.2453,
      longitude: -97.7622,
    },
  },
  {
    resourceType: "Location",
    id: "location-nurse-3",
    status: "active",
    name: "Sarah Johnson Office",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: "HOSP",
          display: "Hospital",
        },
      ],
    },
    telecom: [
      {
        system: "phone",
        value: "512-555-9012",
      },
    ],
    address: {
      use: "work",
      type: "both",
      text: "789 Pine St, Austin, TX 78705",
      line: ["789 Pine St"],
      city: "Austin",
      state: "TX",
      postalCode: "78705",
    },
    position: {
      latitude: 30.2849,
      longitude: -97.7341,
    },
  },
];

// Patients (FHIR Patients)
const mockPatients = [
  {
    resourceType: "Patient",
    id: "patient-1",
    active: true,
    name: [
      {
        use: "official",
        family: "Johnson",
        given: ["Robert"],
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "512-555-1111",
        use: "home",
      },
      {
        system: "email",
        value: "robert.johnson@example.com",
      },
    ],
    gender: "male",
    birthDate: "1945-08-15",
    address: [
      {
        use: "home",
        type: "both",
        text: "101 E 15th St, Austin, TX 78701",
        line: ["101 E 15th St"],
        city: "Austin",
        state: "TX",
        postalCode: "78701",
      },
    ],
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/patient-careNeeds",
        extension: [
          {
            url: "careNeed",
            valueString: "Medication Management",
          },
          {
            url: "careNeed",
            valueString: "Blood Pressure Monitoring",
          },
        ],
      },
    ],
    text: {
      status: "generated",
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient has history of hypertension and requires regular BP monitoring.</div>',
    },
  },
  {
    resourceType: "Patient",
    id: "patient-2",
    active: true,
    name: [
      {
        use: "official",
        family: "Miller",
        given: ["Sarah"],
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "512-555-2222",
        use: "home",
      },
      {
        system: "email",
        value: "sarah.miller@example.com",
      },
    ],
    gender: "female",
    birthDate: "1952-05-21",
    address: [
      {
        use: "home",
        type: "both",
        text: "4501 Spicewood Springs Rd, Austin, TX 78759",
        line: ["4501 Spicewood Springs Rd"],
        city: "Austin",
        state: "TX",
        postalCode: "78759",
      },
    ],
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/patient-careNeeds",
        extension: [
          {
            url: "careNeed",
            valueString: "Wound Care",
          },
          {
            url: "careNeed",
            valueString: "Physical Therapy",
          },
        ],
      },
    ],
    text: {
      status: "generated",
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient recovering from hip replacement surgery. Needs assistance with wound care and physical therapy.</div>',
    },
  },
  {
    resourceType: "Patient",
    id: "patient-3",
    active: true,
    name: [
      {
        use: "official",
        family: "Wilson",
        given: ["David"],
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "512-555-3333",
        use: "home",
      },
      {
        system: "email",
        value: "david.wilson@example.com",
      },
    ],
    gender: "male",
    birthDate: "1938-12-03",
    address: [
      {
        use: "home",
        type: "both",
        text: "1000 W 45th St, Austin, TX 78756",
        line: ["1000 W 45th St"],
        city: "Austin",
        state: "TX",
        postalCode: "78756",
      },
    ],
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/patient-careNeeds",
        extension: [
          {
            url: "careNeed",
            valueString: "Diabetes Management",
          },
          {
            url: "careNeed",
            valueString: "Insulin Administration",
          },
        ],
      },
    ],
    text: {
      status: "generated",
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient has Type 1 diabetes and requires insulin administration. Also needs help with glucose monitoring.</div>',
    },
  },
  {
    resourceType: "Patient",
    id: "patient-4",
    active: true,
    name: [
      {
        use: "official",
        family: "Brown",
        given: ["Patricia"],
      },
    ],
    telecom: [
      {
        system: "phone",
        value: "512-555-4444",
        use: "home",
      },
      {
        system: "email",
        value: "patricia.brown@example.com",
      },
    ],
    gender: "female",
    birthDate: "1960-10-15",
    address: [
      {
        use: "home",
        type: "both",
        text: "8600 Bluffstone Cove, Austin, TX 78759",
        line: ["8600 Bluffstone Cove"],
        city: "Austin",
        state: "TX",
        postalCode: "78759",
      },
    ],
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/patient-careNeeds",
        extension: [
          {
            url: "careNeed",
            valueString: "Respiratory Therapy",
          },
          {
            url: "careNeed",
            valueString: "Oxygen Management",
          },
        ],
      },
    ],
    text: {
      status: "generated",
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient has COPD and requires oxygen therapy and respiratory assessments.</div>',
    },
  },
];

// Patient locations (derived from patients)
const mockPatientLocations = mockPatients.map((patient) => {
  return {
    resourceType: "Location",
    id: `location-${patient.id}`,
    status: "active",
    name: `${patient.name[0].given[0]} ${patient.name[0].family} Home`,
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: "PTRES",
          display: "Patient's Residence",
        },
      ],
    },
    telecom: patient.telecom.filter((t) => t.system === "phone"),
    address: patient.address[0],
    position: {
      // Example coordinates - would be properly geocoded in a real app
      latitude: 30.25 + Math.random() * 0.1,
      longitude: -97.75 - Math.random() * 0.1,
    },
  };
});

// Appointments (FHIR Appointments)
const mockAppointments = [
  {
    resourceType: "Appointment",
    id: "appointment-1",
    status: "booked",
    serviceType: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/service-type",
            code: "57",
            display: "Immunization",
          },
        ],
        text: "Medication Administration",
      },
    ],
    start: "2023-08-15T09:00:00-05:00",
    end: "2023-08-15T09:30:00-05:00",
    participant: [
      {
        actor: {
          reference: "Patient/patient-1",
          display: "Robert Johnson",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Practitioner/nurse-1",
          display: "Jane Smith, RN",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Location/location-patient-1",
          display: "Robert Johnson Home",
        },
        status: "accepted",
      },
    ],
    comment: "Regular blood pressure check and medication review",
  },
  {
    resourceType: "Appointment",
    id: "appointment-2",
    status: "booked",
    serviceType: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/service-type",
            code: "57",
            display: "Immunization",
          },
        ],
        text: "Wound Care",
      },
    ],
    start: "2023-08-15T10:30:00-05:00",
    end: "2023-08-15T11:15:00-05:00",
    participant: [
      {
        actor: {
          reference: "Patient/patient-2",
          display: "Sarah Miller",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Practitioner/nurse-1",
          display: "Jane Smith, RN",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Location/location-patient-2",
          display: "Sarah Miller Home",
        },
        status: "accepted",
      },
    ],
    comment: "Post-surgical wound dressing change and assessment",
  },
  {
    resourceType: "Appointment",
    id: "appointment-3",
    status: "booked",
    serviceType: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/service-type",
            code: "57",
            display: "Immunization",
          },
        ],
        text: "Diabetes Management",
      },
    ],
    start: "2023-08-15T13:00:00-05:00",
    end: "2023-08-15T13:45:00-05:00",
    participant: [
      {
        actor: {
          reference: "Patient/patient-3",
          display: "David Wilson",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Practitioner/nurse-1",
          display: "Jane Smith, RN",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Location/location-patient-3",
          display: "David Wilson Home",
        },
        status: "accepted",
      },
    ],
    comment: "Insulin administration and blood glucose monitoring",
  },
  {
    resourceType: "Appointment",
    id: "appointment-4",
    status: "booked",
    serviceType: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/service-type",
            code: "57",
            display: "Immunization",
          },
        ],
        text: "Respiratory Therapy",
      },
    ],
    start: "2023-08-15T09:00:00-05:00",
    end: "2023-08-15T09:45:00-05:00",
    participant: [
      {
        actor: {
          reference: "Patient/patient-4",
          display: "Patricia Brown",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Practitioner/nurse-2",
          display: "John Doe, RN",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: "Location/location-patient-4",
          display: "Patricia Brown Home",
        },
        status: "accepted",
      },
    ],
    comment: "Oxygen therapy assessment and respiratory exercises",
  },
];

module.exports = {
  mockNurses,
  mockNurseLocations,
  mockPatients,
  mockPatientLocations,
  mockAppointments,
};
