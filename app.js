const express = require('express');
const http = require('http');
const app = express();

const MongoClient = require("mongodb").MongoClient;
const mongoClient = new MongoClient("mongodb://localhost:27017/", { useNewUrlParser: true, useUnifiedTopology: true });

let dbClient;

mongoClient.connect(function(err, client){

    if(err){
        return console.error(err);
    }
    dbClient = client;
    app.locals.weather = client.db("weather").collection("weather");
    app.locals.temperature = client.db("weather").collection("temperature");
    console.log('db connected');
    app.listen(3000);
});


const formatResponse = dt => {
    let {current} = dt;
    return `~${current.wind_speed};${current.temperature};${current.pressure};${current.humidity};${current.cloudcover};${current.feelslike};${current.wind_degree};${current.wind_dir};${current.weather_descriptions.join(',')}~`
};

app.get('/getWeather', (req, resp, next) => {
    console.log('getWeather response');
    app.locals.weather.find().sort({logDate: -1}).limit(1).toArray( (err, res) => {
        const curDate = new Date();
        let isLoadFromCache = false;
        let dt;
        if (res.length > 0) {
            dt = res[0];
            console.log(dt);
            isLoadFromCache =  (curDate - new Date(dt.logDate)) / 1000 / 60 / 60  <= 0.5;
        };
        if (isLoadFromCache) {
            console.log('reading from cache');
            console.log(formatResponse(dt.dt));
            resp.write(formatResponse(dt.dt));
            resp.end();
        } else {
            console.log('fetching new request');
            const options  = {
                hostname: 'api.weatherstack.com',
                path: '/current?access_key=4d085e497cbde0e462bcdb978cf1b3cb&query=Kiev&unit=m',
            };
            let apiReq =  http.request(options, apiResp => {
                console.log(`STATUS: ${apiResp.statusCode}`);
                apiResp.setEncoding('utf8');
                apiResp.on('data', data => {
                    try {
                        const dt = JSON.parse(data);
                        app.locals.weather.insertOne({logDate: new Date(), dt});
                        resp.write(formatResponse(dt));
                        resp.end();
                    }
                    catch (err) {
                        next(err);
                    }
                });
            });
            apiReq.end();
        }



    })



});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(500);
  res.send({ error: err.toString() });
});

process.on("SIGINT", () => {
    dbClient.close();
    console.log('db closed');
    process.exit();
});
