const { Client } = require('@elastic/elasticsearch');


let client = (host) => {
    try {
        return new Client({node: host});
    } catch (e) {
        return e;
    }
};

module.exports = client;
