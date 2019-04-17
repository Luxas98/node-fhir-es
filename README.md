FHIR API Server + Elasticsearch Initial Implementation
===========================================

This project is fork of [@asymetrik/node-fhir-server](https://github.com/Asymmetrik/node-fhir-server-mongo) mongo implementation, with several new functions and backend supported by elasticsearch. Please read about asymetrik/node-fhir-server before. 

### Current implementation status

Work in progress, not a production ready system. 

`ES version: 7.6`
`FHIR version: 3.0.1`

Resource:

    Encounter
        * create, delete, everything, update, search, searchById
        * search support:
            * all object fields including search on references based on FHIR specification
            * _id, _text, _content, _sort
        
    Patient
        * create, delete, everything, update, search, searchById
        * search param support:
            * all object fields including search on references based on FHIR specification
            * _id, _text, _content, _sort
        
    Observation
        * create, delete, update, search, searchById
        * search param support:
            * all object fields including search on references based on FHIR specification
            * _id, _text, _content, _sort
        
    Procedure
        * create, delete, update, search, searchById
        * search param support:
            * all object fields including search on references based on FHIR specification
            * _id, _text, _content, _sort
    
    Condition
        * create, delete, update, search, searchById
        * search param support:
            * all object fields including search on references based on FHIR specification
            * _id, _text, _content, _sort
        
    MedicationAdministration
        * create, delete, update, search, searchById
        * search param support:
            * all object fields including search on references based on FHIR specification
            * _id, _text, _content, _sort
        
    DiagnosticReport
        * create, delete, update, search, searchById
        * search param support:
            * all object fields including search on references based on FHIR specification
            * _id, _text, _content, _sort
            
     Questionnaire
        * create, delete, update, search. searchById


## Getting Started with Docker

1. Install the latest [Docker Community Edition](https://www.docker.com/community-edition) for your OS if you do not already have it installed.
2. Run `docker-compose up`.

## Getting Started with Node

1. Install the latest LTS for [Node.js](https://nodejs.org/en/) if you do not already have it installed.
2. Run `elasticsearch`: `docker-compose up -d elasticsearch`
3. Make sure the default values defined in `env.json` are valid.
4. Run `yarn` or `npm install`.
5. Run `yarn start` or `npm run start`.

(Optional)6. Run `yarn debug` or `npm run debug` for enabled debugger.

## Next Steps
The server should now be up and running on the default port 3000. You should see the following output:

```shell
... - verbose: Server is up and running!
```

## Loading indices and data
1. Load example indices `cd fhir/elasticsearch/mappings/STU3/ && python python load_mappings.py && cd -`
2. Load demo data `cd scripts && python load_synthea_data.py && cd -`    
       
Original elasticsearch mappings taken from [fhirpath](https://github.com/nazrulworld/fhirpath) and added several missing fields for STU3
