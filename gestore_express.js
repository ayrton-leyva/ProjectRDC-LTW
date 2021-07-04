//setup database
const { Client } = require('pg');
const util = require('util');

const client = new Client({
    user: 'test',
    host: 'localhost',
    database: 'testdb',
    password: 'test',
    port: 5432,
});

client.connect();

const query = util.promisify(client.query).bind(client);


const fetch = require('node-fetch');
//used to make API keys invisible by not committing .env file
require('dotenv').config();
//retrieve API key from .env file
var RIOT_KEY = process.env.RIOT_KEY;
var clientID = process.env.clientID;
var clientSecret = process.env.clientSecret;
var redirectURI = process.env.redirectURI;
//used to handle http requests
const express = require('express');
var app = express();
//websocket
const expressWs = require('express-ws')(app);
var path = require('path');
//used to handle json requests, retrieving jquery
var bodyParser = require("body-parser");
const { count } = require('console');
app.use(bodyParser.urlencoded({ extended: false }));



//used to include static file, such as css inside public/css
app.use(express.static(path.join(__dirname, 'public')));

//used to get index file(homepage) and send it to clients
app.get('/', function (req, resp) {
    resp.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/index.html', function (req, resp) {
    resp.sendFile(path.join(__dirname + '/index.html'));
});




//oauth
const request = require('request');

app.get('/login', function (req, resp) {
    resp.redirect("https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/spreadsheets&response_type=code&include_granted_scopes=true&state=state_parameter_passthrough_value&redirect_uri=" + redirectURI + "&client_id=" + clientID);
});

app.get('/redirect', function (req, resp) {
    var formData = {
        code: req.query.code,
        client_id: clientID,
        client_secret: clientSecret,
        redirect_uri: redirectURI,
        grant_type: 'authorization_code'
    }
    request.post({ url: 'https://www.googleapis.com/oauth2/v4/token', form: formData }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            return console.error('upload failed:', err);
        }
        let info = JSON.parse(body);
        let date = new Date();
        let nome = "LeaderboardTFT " + "(" + ("00" + (date.getMonth() + 1)).slice(-2) + "/" +
            ("00" + date.getDate()).slice(-2) + "/" +
            date.getFullYear() + " " +
            ("00" + date.getHours()).slice(-2) + ":" +
            ("00" + date.getMinutes()).slice(-2) + ":" +
            ("00" + date.getSeconds()).slice(-2) + ")";

        var options = {
            url: 'https://sheets.googleapis.com/v4/spreadsheets',
            headers: {
                'Authorization': 'Bearer ' + info.access_token
            },
            body: JSON.stringify({
                "properties": {
                    "title": nome
                }
            })
        };
        request.post(options, function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var info2 = JSON.parse(body);

                let challengerData = fetch('https://euw1.api.riotgames.com/tft/league/v1/challenger?api_key=' + RIOT_KEY)
                    .then(function (response) {
                        return response.json();
                    }).then(function (chData) {
                        let leaderboard = chData.entries.sort(function (a, b) {
                            return parseInt(b.leaguePoints, 10) - parseInt(a.leaguePoints, 10);
                        }).slice(0, 50);
                        //for per inserire dinamicamente i valori da leaderboard a values
                        let obj = '{"values":[["#","Points","Name","Rank","Wins","Losses"]]}';
                        let values = JSON.parse(obj)
                        for (let i = 0; i < 50; i++) {
                            values['values'].push([i + 1, leaderboard[i].leaguePoints, leaderboard[i].summonerName, "C1", leaderboard[i].wins, leaderboard[i].losses]);
                        }

                        var options = {
                            url: 'https://sheets.googleapis.com/v4/spreadsheets/' + info2.spreadsheetId + '/values/A1:append?valueInputOption=RAW',
                            headers: {
                                'Authorization': 'Bearer ' + info.access_token
                            },
                            body: JSON.stringify(values)
                        };
                        request.post(options, function callback(error, response, body) {
                            if (!error && response.statusCode == 200) {
                                var info3 = JSON.parse(body);
                                resp.send("<h3>Spreadsheet created. It contains TFT leaderboard up to date</h3><br><a href='" + info2.spreadsheetUrl + "'>Check spreadsheet</a><br><a href='index.html'>Return to the homepage</a>");
                            }
                            else {
                                console.log(error);
                            }
                        });
                    }).catch(function (error) {
                        console.warn(error);
                    });

            }
            else {
                console.log(error);
            }
        });
    });
});





























//////////////LOL/////////////////

//used to get LeagueOfLegends page and send it to clients
app.get('/LOL.html', function (req, resp) {
    resp.sendFile(path.join(__dirname + '/LOL.html'));
});

//used to make API request for LeagueOfLegends and send it to clients
app.post('/LOL.html/Data', function (req, resp) {
    (async () => {
        try {
            //search check
            let country = await getCountry(req.query.region);
            let array = [];
            let Summoner_DB = await query("select revisionDate from LOL_Summoner where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
            //c'e
            if (Summoner_DB.rows.length != 0) {
                //check
                if ((new Date().getTime() - parseInt(Summoner_DB.rows[0].revisiondate)) > 2100000) {
                    //old
                    //update
                    await query("update LOL_Summoner set revisionDate=" + new Date().getTime() + " where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
                    //update summoner
                    let Update_Summoner_DB = await query("select * from LOL_Summoner where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
                    //delete league
                    await query("delete from LOL_League where id='" + Update_Summoner_DB.rows[0].id + "' and name='" + req.query.summoner + "'");
                    //api league
                    let Search_League_API = await fetch('https://' + req.query.region + '.api.riotgames.com/lol/league/v4/entries/by-summoner/' + Update_Summoner_DB.rows[0].id + '?api_key=' + RIOT_KEY);
                    let League_API = await Search_League_API.json();
                    //check se league vuoto
                    if (League_API == "") {
                        //league è vuoto
                        //insert league vuoto
                        await query("insert into lol_league(queueType,tier,rank,id,name,leaguePoints,wins,losses,veteran,inactive,freshBlood,hotStreak)" +
                            " values ('null','null', 'null', '" + Update_Summoner_DB.rows[0].id + "','" + Update_Summoner_DB.rows[0].name + "',0,0,0, false, false, false, false)");
                        //api matchlist
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    } else {
                        //league esiste
                        //insert league
                        await query("insert into lol_league(queueType,tier,rank,id,name,leaguePoints,wins,losses,veteran,inactive,freshBlood,hotStreak)" +
                            " values ('" + League_API[0].queueType + "','" + League_API[0].tier + "','" + League_API[0].rank + "','" + League_API[0].summonerId +
                            "','" + League_API[0].summonerName + "'," + League_API[0].leaguePoints + "," + League_API[0].wins + "," + League_API[0].losses +
                            "," + League_API[0].veteran + "," + League_API[0].inactive + "," + League_API[0].freshBlood + "," + League_API[0].hotStreak + ")");
                        //api matchlist
                        let Search_MatchList_API = await fetch('https://' + country + '.api.riotgames.com/lol/match/v5/matches/by-puuid/' + Update_Summoner_DB.rows[0].puuid + '/ids?count=5&api_key=' + RIOT_KEY);
                        let MatchList_API = await Search_MatchList_API.json();
                        for (let i = 0; i < Object.keys(MatchList_API).length; i++) {
                            let MatchList_DB = await query("select gametype from LOL_MatchList where matchId='" + MatchList_API[i] + "'");
                            //check
                            if (MatchList_DB.rowCount == 0) {
                                //valore non presente
                                //api matchdata
                                let Search_MatchData_API = await fetch('https://' + country + '.api.riotgames.com/lol/match/v5/matches/' + MatchList_API[i] + '?api_key=' + RIOT_KEY);
                                let MatchData_API = await Search_MatchData_API.json();
                                //insert matchlist
                                await query("insert into lol_matchlist(matchId,gameDuration,gameMode,gameType,gameVersion,mapId," +
                                    "A_name_1,A_name_2,A_name_3,A_name_4,A_name_5,B_name_1,B_name_2,B_name_3,B_name_4,B_name_5,date) " +
                                    "values ('" + MatchData_API.metadata.matchId + "'," + MatchData_API.info.gameDuration + ",'" + MatchData_API.info.gameMode + "','" +
                                    MatchData_API.info.gameType + "','" + MatchData_API.info.gameVersion + "'," + MatchData_API.info.mapId + ",'" +
                                    MatchData_API.info.participants[0].summonerName + "','" + MatchData_API.info.participants[1].summonerName + "','" +
                                    MatchData_API.info.participants[2].summonerName + "','" + MatchData_API.info.participants[3].summonerName + "','" +
                                    MatchData_API.info.participants[4].summonerName + "','" + MatchData_API.info.participants[5].summonerName + "','" +
                                    MatchData_API.info.participants[6].summonerName + "','" + MatchData_API.info.participants[7].summonerName + "','" +
                                    MatchData_API.info.participants[8].summonerName + "','" + MatchData_API.info.participants[9].summonerName + "',to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                //insert matchdata
                                for (let e = 0; e < 10; e++) {
                                    await query("insert into lol_matchdata(puuid,matchId,assist,deaths,kills,championName,champLevel," +
                                        "goldEarned,lane,magicDamageDealt,physicalDamageDealt,totalDamageDealt,trueDamageDealt,turretKills,visionScore,win,teamId,date) " +
                                        "values ('" + MatchData_API.info.participants[e].puuid + "','" + MatchData_API.metadata.matchId + "'," + MatchData_API.info.participants[e].assists + "," +
                                        MatchData_API.info.participants[e].deaths + "," + MatchData_API.info.participants[e].kills + ",'" +
                                        MatchData_API.info.participants[e].championName + "'," + MatchData_API.info.participants[e].champLevel + "," + MatchData_API.info.participants[e].goldEarned + ",'" +
                                        MatchData_API.info.participants[e].lane + "'," + MatchData_API.info.participants[e].magicDamageDealt + "," + MatchData_API.info.participants[e].physicalDamageDealt + "," +
                                        MatchData_API.info.participants[e].totalDamageDealt + "," + MatchData_API.info.participants[e].trueDamageDealt + "," + MatchData_API.info.participants[e].turretKills + "," +
                                        MatchData_API.info.participants[e].visionScore + "," + MatchData_API.info.participants[e].win + "," + MatchData_API.info.participants[e].teamId + ",to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                }
                            }
                            else {
                                //valore presente nel DB
                                continue;
                            }
                        }
                        //invio dati
                        let Send_League_DB = await query("select * from lol_league where id='" + Update_Summoner_DB.rows[0].id + "' and name='" + Update_Summoner_DB.rows[0].name + "'");
                        let Send_MatchData_DB = await query("select * from lol_matchdata where puuid='" + Update_Summoner_DB.rows[0].puuid + "' order by date desc  limit 5");
                        if (Send_MatchData_DB.rowCount == 0) {
                            let Send_204 = { "status": "204" };
                            resp.send(Send_204);

                        } else if (Send_MatchData_DB.rowCount < 5) {
                            let Send_422 = { "status": "422" };
                            resp.send(Send_422);
                        }
                        else {
                            let Send_MatchList_DB = await query("select *" +
                                " from lol_matchlist where matchId in ('" + Send_MatchData_DB.rows[0].matchid + "','" + Send_MatchData_DB.rows[1].matchid + "','" +
                                Send_MatchData_DB.rows[2].matchid + "','" + Send_MatchData_DB.rows[3].matchid + "','" + Send_MatchData_DB.rows[4].matchid + "')");
                            let Send_champion = await query("select championname, cnt FROM ( select championname, cnt, RANK() OVER (PARTITION BY championname ORDER BY cnt DESC) AS rn FROM ( select championname, COUNT(championname) AS cnt FROM lol_matchdata WHERE puuid='" + Update_Summoner_DB.rows[0].puuid + "' GROUP BY championname) t) s WHERE s.rn = 1")
                            array.push(Update_Summoner_DB.rows[0]);
                            array.push(Send_League_DB.rows[0]);
                            array.push(Send_MatchData_DB.rows);
                            array.push(Send_MatchList_DB.rows);
                            array.push(Send_champion.rows[0]);
                            resp.send(array);
                        }
                    }

                }//aggiornato
                else {
                    //invio dati
                    let Send_Summoner = await query("select * from lol_summoner where name='" + req.query.summoner + "' and region='" + req.query.region + "'");
                    let Send_League_DB = await query("select * from lol_league where id='" + Send_Summoner.rows[0].id + "' and name='" + Send_Summoner.rows[0].name + "'");
                    let Send_MatchData_DB = await query("select * from lol_matchdata where puuid='" + Send_Summoner.rows[0].puuid + "' order by date desc  limit 5");
                    if (Send_MatchData_DB.rowCount == 0) {
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    }
                    else if (Send_MatchData_DB.rowCount < 5) {
                        let Send_422 = { "status": "422" };
                        resp.send(Send_422);
                    }
                    else {
                        let Search_MatchList_DB = await query("select *" +
                            " from lol_matchlist where matchId in ('" + Send_MatchData_DB.rows[0].matchid + "','" + Send_MatchData_DB.rows[1].matchid + "','" +
                            Send_MatchData_DB.rows[2].matchid + "','" + Send_MatchData_DB.rows[3].matchid + "','" + Send_MatchData_DB.rows[4].matchid + "')");
                        let Send_champion = await query("select championname, cnt FROM ( select championname, cnt, RANK() OVER (PARTITION BY championname ORDER BY cnt DESC) AS rn FROM ( select championname, COUNT(championname) AS cnt FROM lol_matchdata WHERE puuid='" + Send_Summoner.rows[0].puuid + "' GROUP BY championname) t) s WHERE s.rn = 1")
                        array.push(Send_Summoner.rows[0]);
                        array.push(Send_League_DB.rows[0]);
                        array.push(Send_MatchData_DB.rows);
                        array.push(Search_MatchList_DB.rows);
                        array.push(Send_champion.rows[0]);
                        resp.send(array);
                    }
                }
            }
            //non c'è
            else {
                //api summoner
                let Search_Summoner_API = await fetch('https://' + req.query.region + '.api.riotgames.com/lol/summoner/v4/summoners/by-name/' + req.query.summoner + '?api_key=' + RIOT_KEY);
                let Summoner_API = await Search_Summoner_API.json();
                //check
                if (JSON.stringify(Summoner_API).includes("id")) {
                    //insert summoner
                    await query("insert into LOL_Summoner (region, id, puuid, name, revisionDate, summonerLevel) values ('" + req.query.region + "','" + Summoner_API.id + "','" + Summoner_API.puuid + "','" + Summoner_API.name + "'," + new Date().getTime() + "," + Summoner_API.summonerLevel + ")");
                    //api league
                    let Search_League_API = await fetch('https://' + req.query.region + '.api.riotgames.com/lol/league/v4/entries/by-summoner/' + Summoner_API.id + '?api_key=' + RIOT_KEY);
                    let League_API = await Search_League_API.json();
                    //check se league vuoto
                    if (League_API == "") {
                        //league è vuoto
                        //insert league vuoto
                        await query("insert into lol_league(queueType,tier,rank,id,name,leaguePoints,wins,losses,veteran,inactive,freshBlood,hotStreak)" +
                            " values ('null','null', 'null', '" + Summoner_API.id + "','" + Summoner_API.name + "',0,0,0, false, false, false, false)");
                        //api matchlist
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    } else {
                        //league esiste
                        //insert league
                        await query("insert into lol_league(queueType,tier,rank,id,name,leaguePoints,wins,losses,veteran,inactive,freshBlood,hotStreak)" +
                            " values ('" + League_API[0].queueType + "','" + League_API[0].tier + "','" + League_API[0].rank + "','" + League_API[0].summonerId +
                            "','" + League_API[0].summonerName + "'," + League_API[0].leaguePoints + "," + League_API[0].wins + "," + League_API[0].losses +
                            "," + League_API[0].veteran + "," + League_API[0].inactive + "," + League_API[0].freshBlood + "," + League_API[0].hotStreak + ")");
                        //api matchlist
                        let Search_MatchList_API = await fetch('https://' + country + '.api.riotgames.com/lol/match/v5/matches/by-puuid/' + Summoner_API.puuid + '/ids?count=5&api_key=' + RIOT_KEY);
                        let MatchList_API = await Search_MatchList_API.json();
                        for (let i = 0; i < Object.keys(MatchList_API).length; i++) {
                            let MatchList_DB = await query("select gametype from LOL_MatchList where matchId='" + MatchList_API[i] + "'");
                            //check
                            if (MatchList_DB.rowCount == 0) {
                                //valore non presente
                                //api matchdata
                                let Search_MatchData_API = await fetch('https://' + country + '.api.riotgames.com/lol/match/v5/matches/' + MatchList_API[i] + '?api_key=' + RIOT_KEY);
                                let MatchData_API = await Search_MatchData_API.json();
                                if (Object.keys(MatchData_API).length == 1) continue;
                                else {
                                    //insert matchlist
                                    await query("insert into lol_matchlist(matchId,gameDuration,gameMode,gameType,gameVersion,mapId," +
                                        "A_name_1,A_name_2,A_name_3,A_name_4,A_name_5,B_name_1,B_name_2,B_name_3,B_name_4,B_name_5,date) " +
                                        "values ('" + MatchData_API.metadata.matchId + "'," + MatchData_API.info.gameDuration + ",'" + MatchData_API.info.gameMode + "','" +
                                        MatchData_API.info.gameType + "','" + MatchData_API.info.gameVersion + "'," + MatchData_API.info.mapId + ",'" +
                                        MatchData_API.info.participants[0].summonerName + "','" + MatchData_API.info.participants[1].summonerName + "','" +
                                        MatchData_API.info.participants[2].summonerName + "','" + MatchData_API.info.participants[3].summonerName + "','" +
                                        MatchData_API.info.participants[4].summonerName + "','" + MatchData_API.info.participants[5].summonerName + "','" +
                                        MatchData_API.info.participants[6].summonerName + "','" + MatchData_API.info.participants[7].summonerName + "','" +
                                        MatchData_API.info.participants[8].summonerName + "','" + MatchData_API.info.participants[9].summonerName + "',to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                    //insert matchdata
                                    for (let e = 0; e < 10; e++) {
                                        await query("insert into lol_matchdata(puuid,matchId,assist,deaths,kills,championName,champLevel," +
                                            "goldEarned,lane,magicDamageDealt,physicalDamageDealt,totalDamageDealt,trueDamageDealt,turretKills,visionScore,win,teamId,date) " +
                                            "values ('" + MatchData_API.info.participants[e].puuid + "','" + MatchData_API.metadata.matchId + "'," + MatchData_API.info.participants[e].assists + "," +
                                            MatchData_API.info.participants[e].deaths + "," + MatchData_API.info.participants[e].kills + ",'" +
                                            MatchData_API.info.participants[e].championName + "'," + MatchData_API.info.participants[e].champLevel + "," + MatchData_API.info.participants[e].goldEarned + ",'" +
                                            MatchData_API.info.participants[e].lane + "'," + MatchData_API.info.participants[e].magicDamageDealt + "," + MatchData_API.info.participants[e].physicalDamageDealt + "," +
                                            MatchData_API.info.participants[e].totalDamageDealt + "," + MatchData_API.info.participants[e].trueDamageDealt + "," + MatchData_API.info.participants[e].turretKills + "," +
                                            MatchData_API.info.participants[e].visionScore + "," + MatchData_API.info.participants[e].win + "," + MatchData_API.info.participants[e].teamId + ",to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                    }
                                }
                            }
                            else {
                                //valore presente nel DB
                                continue;
                            }
                        }
                        //invio dati
                        let Send_Summoner = await query("select * from lol_summoner where name='" + req.query.summoner + "' and region='" + req.query.region + "'");
                        let Send_League_DB = await query("select * from lol_league where id='" + Send_Summoner.rows[0].id + "' and name='" + Send_Summoner.rows[0].name + "'");
                        let Send_MatchData_DB = await query("select *" +
                            " from lol_matchdata where puuid='" + Summoner_API.puuid + "' order by date desc  limit 5");
                        if (Send_MatchData_DB.rowCount == 0) {
                            let Send_204 = { "status": "204" };
                            resp.send(Send_204);
                        }
                        else if (Send_MatchData_DB.rowCount < 5) {
                            let Send_422 = { "status": "422" };
                            resp.send(Send_422);
                        }
                        else {
                            let Send_MatchList_DB = await query("select *" +
                                " from lol_matchlist where matchId in ('" + Send_MatchData_DB.rows[0].matchid + "','" + Send_MatchData_DB.rows[1].matchid + "','" +
                                Send_MatchData_DB.rows[2].matchid + "','" + Send_MatchData_DB.rows[3].matchid + "','" + Send_MatchData_DB.rows[4].matchid + "')");
                            let Send_champion = await query("select championname, cnt FROM ( select championname, cnt, RANK() OVER (PARTITION BY championname ORDER BY cnt DESC) AS rn FROM ( select championname, COUNT(championname) AS cnt FROM lol_matchdata WHERE puuid='" + Send_Summoner.rows[0].puuid + "' GROUP BY championname) t) s WHERE s.rn = 1")
                            array.push(Send_Summoner.rows[0]);
                            array.push(Send_League_DB.rows[0]);
                            array.push(Send_MatchData_DB.rows);
                            array.push(Send_MatchList_DB.rows);
                            array.push(Send_champion.rows[0]);
                            resp.send(array);
                        }
                    }
                }//error
                else {
                    //invio 404
                    let Send_404 = { "status": "404" };
                    resp.send(Send_404);
                }
            }
        }
        catch (e) { console.log(e); }
    })();
});





//////////////TFT/////////////////

//used to get TeamFightTactics page and send it to clients
app.get('/TFT.html', function (req, resp) {
    resp.sendFile(path.join(__dirname + '/TFT.html'));
});

app.post('/TFT.html/Data', function (req, resp) {
    (async () => {
        try {
            //search
            let country = await getCountry(req.query.region);
            let array = [];
            let Summoner_DB = await query("select revisiondate from TFT_Summoner where region='" + req.query.region + "' and name='" + req.query.summoner + "'");
            //c'e
            if (Summoner_DB.rowCount == 1) {
                //check
                if ((new Date().getTime() - parseInt(Summoner_DB.rows[0].revisiondate)) > 2100000) {
                    //old
                    //update
                    await query("update TFT_Summoner set revisionDate=" + new Date().getTime() + " where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
                    //update summonerdelete from tft_summoner where name='FuocoSelvaggio'
                    let Update_Summoner_DB = await query("select * from TFT_Summoner where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
                    //delete league
                    await query("delete from TFT_League where id='" + Update_Summoner_DB.rows[0].id + "' and name='" + req.query.summoner + "'");
                    //api league
                    let Search_League_API = await fetch("https://" + req.query.region + ".api.riotgames.com/tft/league/v1/entries/by-summoner/" + Update_Summoner_DB.rows[0].id + "?api_key=" + RIOT_KEY);
                    let League_API = await Search_League_API.json();
                    //check se league vuoto
                    if ((League_API == "") || (League_API[0].queueType == 'RANKED_TFT_TURBO' && Object.keys(League_API).length == 1)) {
                        //league è vuoto
                        //insert league vuoto
                        await query("insert into TFT_League(queueType,tier,rank,id,name,leaguePoints,wins,losses,veterans,inactive,freshBlood,hotStreak)" +
                            " values ('null','null','null','" + Update_Summoner_DB.rows[0].id + "','" + Update_Summoner_DB.rows[0].name + "',0,0,0,false,false,false,false)");
                        //api matchlist
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    } else {
                        //league esiste
                        //insert league
                        if (Object.keys(League_API).length == 2 && League_API[0].queueType == 'RANKED_TFT_TURBO') {
                            League_API[0] = League_API[1];
                        }
                        await query("insert into TFT_League(queuetype,tier,rank,id,name,leaguePoints,wins,losses,veterans,inactive,freshBlood,hotStreak)" +
                            " values ('" + League_API[0].queueType + "','" + League_API[0].tier + "','" + League_API[0].rank + "','" + League_API[0].summonerId +
                            "','" + League_API[0].summonerName + "'," + League_API[0].leaguePoints + "," + League_API[0].wins + "," + League_API[0].losses +
                            "," + League_API[0].veteran + "," + League_API[0].inactive + "," + League_API[0].freshBlood + "," + League_API[0].hotStreak + ")");
                        //api matchlist
                        let Search_MatchList_API = await fetch('https://' + country + '.api.riotgames.com/tft/match/v1/matches/by-puuid/' + Update_Summoner_DB.rows[0].puuid + '/ids?count=5&api_key=' + RIOT_KEY);
                        let MatchList_API = await Search_MatchList_API.json();
                        for (let i = 0; i < Object.keys(MatchList_API).length; i++) {
                            let MatchList_DB = await query("select game_version from TFT_MatchList where matchId='" + MatchList_API[i] + "'");
                            //check
                            if (MatchList_DB.rowCount == 0) {
                                //valore non presente
                                //api matchdata
                                let Search_MatchData_API = await fetch('https://' + country + '.api.riotgames.com/tft/match/v1/matches/' + MatchList_API[i] + '?api_key=' + RIOT_KEY);
                                let MatchData_API = await Search_MatchData_API.json();
                                //insert matchlist
                                await query("insert into tft_matchlist(matchid,game_length,game_version," +
                                    "puuid_1,puuid_2,puuid_3,puuid_4,puuid_5,puuid_6,puuid_7,puuid_8,date)" +
                                    " values ('" + MatchData_API.metadata.match_id + "'," + MatchData_API.info.game_length + ",'" + MatchData_API.info.game_version + "','" +
                                    MatchData_API.metadata.participants[0] + "','" + MatchData_API.metadata.participants[1] + "','" + MatchData_API.metadata.participants[2] + "','" +
                                    MatchData_API.metadata.participants[3] + "','" + MatchData_API.metadata.participants[4] + "','" + MatchData_API.metadata.participants[5] + "','" +
                                    MatchData_API.metadata.participants[6] + "','" + MatchData_API.metadata.participants[7] + "',to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                //insert matchdata
                                for (let e = 0; e < 8; e++) {
                                    await query("insert into tft_matchdata(puuid,matchId,gold_left,last_round,level,placement,players_eliminated,total_damage_to_players,date)" +
                                        " values ('" + MatchData_API.info.participants[e].puuid + "','" + MatchData_API.metadata.match_id + "'," +
                                        MatchData_API.info.participants[e].gold_left + "," + MatchData_API.info.participants[e].last_round + "," +
                                        MatchData_API.info.participants[e].level + "," + MatchData_API.info.participants[e].placement + "," +
                                        MatchData_API.info.participants[e].players_eliminated + "," + MatchData_API.info.participants[e].total_damage_to_players + ",to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                }
                            }
                            else {
                                //valore presente nel DB
                                continue;
                            }
                        }
                        //invio dati
                        let Send_League_DB = await query("select * from tft_league where id='" + Update_Summoner_DB.rows[0].id + "' and name='" + Update_Summoner_DB.rows[0].name + "'");
                        let Send_MatchData_DB = await query("select * from tft_matchdata " +
                            "where puuid='" + Update_Summoner_DB.rows[0].puuid + "' order by date desc limit 5");
                        if (Send_MatchData_DB.rowCount == 0) {
                            let Send_204 = { "status": "204" };
                            resp.send(Send_204);
                        }
                        else if (Send_MatchData_DB.rowCount < 5) {
                            let Send_422 = { "status": "422" };
                            resp.send(Send_422);
                        }
                        else {
                            let Send_MatchList_DB = await query("select * from tft_matchlist where matchId in ('" +
                                Send_MatchData_DB.rows[0].matchid + "','" + Send_MatchData_DB.rows[1].matchid + "','" + Send_MatchData_DB.rows[2].matchid + "','" + Send_MatchData_DB.rows[3].matchid
                                + "','" + Send_MatchData_DB.rows[4].matchid + "')");
                            let placement = await query("select placement from tft_matchdata where puuid='" + Update_Summoner_DB.rows[0].puuid + "' order by date desc");
                            array.push(Update_Summoner_DB.rows[0]);
                            array.push(Send_League_DB.rows[0]);
                            array.push(Send_MatchData_DB.rows);
                            array.push(Send_MatchList_DB.rows);
                            array.push(placement.rows);
                            resp.send(array);
                        }
                    }

                }//agg
                else {
                    //invio dati
                    let Send_Summoner = await query("select * from tft_summoner where region='" + req.query.region + "' and  name='" + req.query.summoner + "' ");
                    let Send_League_DB = await query("select * from tft_league where id='" + Send_Summoner.rows[0].id + "' and name='" + Send_Summoner.rows[0].name + "'");
                    let Send_MatchData_DB = await query("select * from tft_matchdata where puuid='" + Send_Summoner.rows[0].puuid + "' order by date desc limit 5");
                    if (Send_MatchData_DB.rowCount == 0) {
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    }
                    else if (Send_MatchData_DB.rowCount < 5) {
                        let Send_422 = { "status": "422" };
                        resp.send(Send_422);
                    }
                    else {
                        let Send_MatchList_DB = await query("select * from tft_matchlist where matchId in ('" +
                            Send_MatchData_DB.rows[0].matchid + "','" + Send_MatchData_DB.rows[1].matchid + "','" + Send_MatchData_DB.rows[2].matchid + "','" + Send_MatchData_DB.rows[3].matchid
                            + "','" + Send_MatchData_DB.rows[4].matchid + "')");
                        let placement = await query("select placement from tft_matchdata where puuid='" + Send_Summoner.rows[0].puuid + "' order by date desc");
                        array.push(Send_Summoner.rows[0]);
                        array.push(Send_League_DB.rows[0]);
                        array.push(Send_MatchData_DB.rows);
                        array.push(Send_MatchList_DB.rows);
                        array.push(placement.rows);
                        resp.send(array);

                    }
                }
                //non c'è
            } else if (Summoner_DB.rowCount == 0) {
                //api summoner
                let Search_Summoner_API = await fetch('https://' + req.query.region + '.api.riotgames.com/tft/summoner/v1/summoners/by-name/' + req.query.summoner + '?api_key=' + RIOT_KEY);
                let Summoner_API = await Search_Summoner_API.json();
                //check
                if (JSON.stringify(Summoner_API).includes("id")) {
                    //insert summoner
                    await query("insert into TFT_Summoner (region, id, puuid, name, revisionDate, summonerLevel)" +
                        " values('" + req.query.region + "','" + Summoner_API.id + "','" + Summoner_API.puuid + "','" + Summoner_API.name + "'," + new Date().getTime() + "," + Summoner_API.summonerLevel + ")");
                    //api league
                    let Search_League_API = await fetch('https://' + req.query.region + '.api.riotgames.com/tft/league/v1/entries/by-summoner/' + Summoner_API.id + '?api_key=' + RIOT_KEY);
                    let League_API = await Search_League_API.json();
                    //check se league vuoto
                    if ((League_API == "") || (League_API[0].queueType == 'RANKED_TFT_TURBO' && Object.keys(League_API).length == 1)) {
                        //league è vuoto
                        //insert league vuoto
                        await query("insert into TFT_League(queueType,tier,rank,id,name,leaguePoints,wins,losses,veterans,inactive,freshBlood,hotStreak)" +
                            " values ('null','null','null','" + Summoner_API.id + "','" + Summoner_API.name + "',0,0,0,false,false,false,false)");
                        //api matchlist
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    } else {
                        //league esiste
                        //insert league
                        if (Object.keys(League_API).length == 2 && League_API[0].queueType == 'RANKED_TFT_TURBO') {
                            League_API[0] = League_API[1];
                        }
                        await query("insert into TFT_League(queuetype,tier,rank,id,name,leaguePoints,wins,losses,veterans,inactive,freshBlood,hotStreak)" +
                            " values ('" + League_API[0].queueType + "','" + League_API[0].tier + "','" + League_API[0].rank + "','" + League_API[0].summonerId +
                            "','" + League_API[0].summonerName + "'," + League_API[0].leaguePoints + "," + League_API[0].wins + "," + League_API[0].losses +
                            "," + League_API[0].veteran + "," + League_API[0].inactive + "," + League_API[0].freshBlood + "," + League_API[0].hotStreak + ")");
                        //api matchlist
                        let Search_MatchList_API = await fetch('https://' + country + '.api.riotgames.com/tft/match/v1/matches/by-puuid/' + Summoner_API.puuid + '/ids?count=5&api_key=' + RIOT_KEY);
                        let MatchList_API = await Search_MatchList_API.json();
                        for (let i = 0; i < Object.keys(MatchList_API).length; i++) {
                            let MatchList_DB = await query("select game_version from TFT_MatchList where matchId='" + MatchList_API[i] + "'");
                            //check

                            if (MatchList_DB.rowCount == 0) {

                                //valore non presente
                                //api matchdata
                                let Search_MatchData_API = await fetch("https://" + country + ".api.riotgames.com/tft/match/v1/matches/" + MatchList_API[i] + "?api_key=" + RIOT_KEY);
                                let MatchData_API = await Search_MatchData_API.json();
                                //insert matchlist
                                await query("insert into tft_matchlist(matchid,game_length,game_version," +
                                    "puuid_1,puuid_2,puuid_3,puuid_4,puuid_5,puuid_6,puuid_7,puuid_8,date)" +
                                    " values ('" + MatchData_API.metadata.match_id + "'," + MatchData_API.info.game_length + ",'" + MatchData_API.info.game_version + "','" +
                                    MatchData_API.metadata.participants[0] + "','" + MatchData_API.metadata.participants[1] + "','" + MatchData_API.metadata.participants[2] + "','" +
                                    MatchData_API.metadata.participants[3] + "','" + MatchData_API.metadata.participants[4] + "','" + MatchData_API.metadata.participants[5] + "','" +
                                    MatchData_API.metadata.participants[6] + "','" + MatchData_API.metadata.participants[7] + "',to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                //insert matchdata
                                for (let e = 0; e < 8; e++) {
                                    await query("insert into tft_matchdata(puuid,matchId,gold_left,last_round,level,placement,players_eliminated,total_damage_to_players,date)" +
                                        " values ('" + MatchData_API.info.participants[e].puuid + "','" + MatchData_API.metadata.match_id + "'," +
                                        MatchData_API.info.participants[e].gold_left + "," + MatchData_API.info.participants[e].last_round + "," +
                                        MatchData_API.info.participants[e].level + "," + MatchData_API.info.participants[e].placement + "," +
                                        MatchData_API.info.participants[e].players_eliminated + "," + MatchData_API.info.participants[e].total_damage_to_players + ",to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                }
                            }
                            else {
                                //valore presente nel DB
                                continue;
                            }
                        }
                        //invio dati
                        let Update_Summoner_DB = await query("select * from tft_summoner where region='" + req.query.region + "' and name='" + req.query.summoner + "'");
                        let Send_League_DB = await query("select * from tft_league where id='" + Update_Summoner_DB.rows[0].id + "' and name='" + Update_Summoner_DB.rows[0].name + "'");
                        let Send_MatchData_DB = await query("select * from tft_matchdata " +
                            "where puuid='" + Update_Summoner_DB.rows[0].puuid + "' order by date desc limit 5");
                        if (Send_MatchData_DB.rowCount == 0) {
                            let Send_204 = { "status": "204" };
                            resp.send(Send_204);
                        }
                        else if (Send_MatchData_DB.rowCount < 5) {
                            let Send_422 = { "status": "422" };
                            resp.send(Send_422);
                        }
                        else {
                            let Send_MatchList_DB = await query("select * from tft_matchlist where matchId in ('" +
                                Send_MatchData_DB.rows[0].matchid + "','" + Send_MatchData_DB.rows[1].matchid + "','" + Send_MatchData_DB.rows[2].matchid + "','" + Send_MatchData_DB.rows[3].matchid
                                + "','" + Send_MatchData_DB.rows[4].matchid + "')");
                            let placement = await query("select placement from tft_matchdata where puuid='" + Update_Summoner_DB.rows[0].puuid + "' order by date desc");
                            array.push(Update_Summoner_DB.rows[0]);
                            array.push(Send_League_DB.rows[0]);
                            array.push(Send_MatchData_DB.rows);
                            array.push(Send_MatchList_DB.rows);
                            array.push(placement.rows);
                            resp.send(array);
                        }
                    }
                }//error
                else {
                    //invio 404
                    let Send_G = { "status": "404" };
                    resp.send(Send_G);
                }
            }

        }
        catch (e) { console.log(e); }
    })();
});





/////////////////////LOR//////////////////////

//used to get LegendsOfRuneterra page and send it to clients
app.get('/LOR.html', function (req, resp) {
    resp.sendFile(path.join(__dirname + '/LOR.html'));
});

app.post('/LOR.html/Data', function (req, resp) {
    (async () => {
        try {
            let country = await getCountry(req.query.region);
            let array = [];
            //Search nel DB se c'è
            let Search_Summoner_DB = await query("select revisionDate from LOR_Summoner where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
            if (Search_Summoner_DB.rows.length == 0) {
                //non c'è nel db
                //chiamata alle API_summoner
                let Search_Summoner_API = await fetch('https://' + req.query.region + '.api.riotgames.com/lol/summoner/v4/summoners/by-name/' + req.query.summoner + '?api_key=' + RIOT_KEY);
                let Summoner_API = await Search_Summoner_API.json();
                if (JSON.stringify(Summoner_API).includes("id")) {
                    //API risultato positivo
                    //inserisci nel summoner
                    await query("insert into LOR_Summoner (region, id, puuid, name, revisionDate, summonerLevel)" +
                        " values('" + req.query.region + "','" + Summoner_API.id + "','" + Summoner_API.puuid + "','" + Summoner_API.name + "'," + new Date().getTime() + "," + Summoner_API.summonerLevel + ")");
                    //chiamata ad API MatchList
                    let Search_MatchList_API = await fetch('https://' + country + '.api.riotgames.com/lor/match/v1/matches/by-puuid/' + Summoner_API.puuid + '/ids?api_key=' + RIOT_KEY);
                    let MatchList_API = await Search_MatchList_API.json();
                    var n = Object.keys(MatchList_API).length;
                    if (n < 5) {
                        let Send_422 = { "status": "422" };
                        resp.send(Send_422);
                    }
                    else {
                        //for ogni valore di Matchlist
                        for (let i = 0; i < Object.keys(MatchList_API).length; i++) {
                            //verifica se all'interno
                            let Search_MatchList_DB = await query("select game_type from LOR_MatchList where matchId='" + MatchList_API[i] + "'");
                            if (Search_MatchList_DB.rowCount != 0) {
                                //c'è gia il Matchlist nel DB
                                //continue
                                continue;
                            } else {
                                //non c'è nel Matchlist
                                //Chiamata ad API MatchData
                                let Search_MatchData_API = await fetch('https://' + country + '.api.riotgames.com/lor/match/v1/matches/' + MatchList_API[i] + '?api_key=' + RIOT_KEY);
                                let MatchData_API = await Search_MatchData_API.json();
                                if (Object.keys(MatchData_API).length < 2) {
                                    //caso in cui il db riot abbia eliminato il dato
                                    continue;
                                }
                                //Insert la Matchlist nel DB
                                await query("insert into LOR_MatchList (matchId,game_type,player_1_puuid,player_2_puuid,date) " +
                                    "values('" + MatchData_API.metadata.match_id + "','" + MatchData_API.info.game_type + "','" + MatchData_API.metadata.participants[0] + "','" + MatchData_API.metadata.participants[1] +
                                    "','" + MatchData_API.info.game_start_time_utc + "')");
                                //for i 2 player
                                for (let j = 0; j < 2; j++) {
                                    //check la lunghezza di MatchData
                                    //se lunghezza è pari a uno e la posizione è la seconda nel for
                                    if (Object.keys(MatchData_API.info.players).length == 1 && j == 1) {
                                        //inserisci il valore dell IA
                                        await query("insert into LOR_MatchData (puuid,matchId,deck_code,factions_1,faction_2,game_outcome,order_of_play,date) " +
                                            "values('IA', '" + MatchData_API.metadata.match_id + "', 'IA_DECK_CODE', 'IA', 'IA', 'IA' ,0,to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                    } else {
                                        //se la posizione è la prima
                                        //inserici il valore del matchdata
                                        await query("insert into LOR_MatchData (puuid,matchId,deck_code,factions_1,faction_2,game_outcome,order_of_play,date) " +
                                            "values('" + MatchData_API.info.players[j].puuid + "','" + MatchData_API.metadata.match_id + "','" + MatchData_API.info.players[j].deck_code +
                                            "','" + MatchData_API.info.players[j].factions[0] + "','" + MatchData_API.info.players[j].factions[1] + "','" + MatchData_API.info.players[j].game_outcome +
                                            "'," + MatchData_API.info.players[j].order_of_play + ",to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                    }
                                }
                            }
                        }
                        //Send Array
                        let Update_Summoner_DB = await query("select * from lor_summoner where region='" + req.query.region + "' and name='" + req.query.summoner + "'");
                        let Search_MatchData_DB = await query("select * " +
                            " from lor_matchdata where puuid='" + Update_Summoner_DB.rows[0].puuid + "' order by date desc  limit 5");
                        if (Search_MatchData_DB.rowCount == 0) {
                            let Send_204 = { "status": "204" };
                            resp.send(Send_204);
                        }
                        else if (Search_MatchData_DB.rowCount < 5) {
                            let Send_422 = { "status": "422" };
                            resp.send(Send_422);
                        }
                        else {
                            let Search_MatchList_DB = await query("select * " +
                                "from lor_matchlist where matchId in ('" + Search_MatchData_DB.rows[0].matchid + "','" + Search_MatchData_DB.rows[1].matchid +
                                "','" + Search_MatchData_DB.rows[2].matchid + "','" + Search_MatchData_DB.rows[3].matchid + "','" + Search_MatchData_DB.rows[4].matchid + "')");
                            let GraphWin = await query("select n.puuid,n.faction,sum(n.cnt) from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata where game_outcome='win' ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata where game_outcome='win' ) as s group by s.faction,s.puuid) as n where puuid='" + Update_Summoner_DB.rows[0].puuid + "' group by n.faction,n.puuid");
                            let GraphLoss = await query("select n.puuid,n.faction,sum(n.cnt) from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata where game_outcome='loss' ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata where game_outcome='loss' ) as s group by s.faction,s.puuid ) as n where puuid='" + Update_Summoner_DB.rows[0].puuid + "' group by n.faction,n.puuid");
                            let FavoriteFactions = await query("select n.puuid,n.faction,sum(n.cnt) as cnt from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata ) as s group by s.faction,s.puuid) as n where puuid='" + Update_Summoner_DB.rows[0].puuid + "' group by n.faction,n.puuid order by cnt desc limit 2");
                            array.push(Update_Summoner_DB.rows[0]);
                            array.push(Search_MatchData_DB.rows);
                            array.push(Search_MatchList_DB.rows);
                            array.push(GraphWin.rows);
                            array.push(GraphLoss.rows);
                            array.push(FavoriteFactions.rows);
                            resp.send(array);
                        }
                    }
                } else {
                    //risultato negativo
                    //send Errore
                    let Send_G = { "status": "404" };
                    resp.send(Send_G);
                }
            } else {
                //c'è nel db
                //check l'eta dei dati
                if ((new Date().getTime() - Search_Summoner_DB.rows[0].revisiondate) > 2100000) {
                    //il dato è vecchio
                    //update il valore di Lor_summoner
                    await query("update LOR_Summoner set revisionDate=" + new Date().getTime() + " where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
                    //search nel Db Lor_summoner
                    let Summoner_API = await query("select * from LOR_Summoner where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
                    //chiamata ad API MatchList
                    let Search_MatchList_API = await fetch('https://' + country + '.api.riotgames.com/lor/match/v1/matches/by-puuid/' + Summoner_API.puuid + '/ids?api_key=' + RIOT_KEY);
                    let MatchList_API = await Search_MatchList_API.json();
                    //for ogni valore di Matchlist
                    for (let i = 0; i < Object.keys(MatchList_API).length; i++) {
                        //verifica se all'interno
                        let Search_MatchList_DB = await query("select game_type from LOR_MatchList where matchId='" + MatchList_API[i] + "'");
                        if (Search_MatchList_DB.rowCount != 0) {
                            //c'è gia il Matchlist nel DB
                            //continue
                            continue;
                        } else {
                            //non c'è nel Matchlist
                            //Chiamata ad API MatchData
                            let Search_MatchData_API = await fetch('https://' + country + '.api.riotgames.com/lor/match/v1/matches/' + MatchList_API[i] + '?api_key=' + RIOT_KEY);
                            let MatchData_API = await Search_MatchData_API.json();
                            if (Object.keys(MatchData_API).length < 2) {
                                //caso in cui il db riot abbia eliminato il dato
                                continue;
                            }
                            //Insert la Matchlist nel DB
                            await query("insert into LOR_MatchList (matchId,game_type,player_1_puuid,player_2_puuid,date) " +
                                "values('" + MatchData_API.metadata.match_id + "','" + MatchData_API.info.game_type + "','" + MatchData_API.metadata.participants[0] + "','" + MatchData_API.metadata.participants[1] +
                                "','" + MatchData_API.info.game_start_time_utc + "')");
                            //for i 2 player
                            for (let j = 0; j < 2; j++) {
                                //check la lunghezza di MatchData
                                //se lunghezza è pari a uno e la posizione è la seconda nel for
                                if (Object.keys(MatchData_API.info.players).length == 1 && j == 1) {
                                    //inserisci il valore dell IA
                                    await query("insert into LOR_MatchData (puuid,matchId,deck_code,factions_1,faction_2,game_outcome,order_of_play,date) " +
                                        "values('IA', '" + MatchData_API.metadata.match_id + "', 'IA_DECK_CODE', 'IA', 'IA', 'IA' ,0,to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                } else {
                                    //se la posizione è la prima
                                    //inserici il valore del matchdata
                                    await query("insert into LOR_MatchData (puuid,matchId,deck_code,factions_1,faction_2,game_outcome,order_of_play,date) " +
                                        "values('" + MatchData_API.info.players[i].puuid + "','" + MatchData_API.metadata.match_id + "','" + MatchData_API.info.players[i].deck_code +
                                        "','" + MatchData_API.info.players[i].factions[0] + "','" + MatchData_API.info.players[i].factions[1] + "','" + MatchData_API.info.players[i].game_outcome +
                                        "'," + MatchData_API.info.players[i].order_of_play + ",to_timestamp(" + new Date().getTime() / 1000 + ")::timestamp without time zone)");
                                }
                            }
                        }
                    }
                    //Send Array
                    let Update_Summoner_DB = await query("select * from lor_summoner where name='" + req.query.summoner + "' and region='" + req.query.region + "'");
                    let Search_MatchData_DB = await query("select *" +
                        " from lor_matchdata where puuid='" + Update_Summoner_DB.rows[0].puuid + "' order by date desc  limit 5");
                    if (Search_MatchData_DB.rowCount == 0) {
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    }
                    else if (Search_MatchData_DB.rowCount < 5) {
                        let Send_422 = { "status": "422" };
                        resp.send(Send_422);
                    }
                    else {
                        let Search_MatchList_DB = await query("select * " +
                            "from lor_matchlist where matchId in ('" + Search_MatchData_DB.rows[0].matchid + "','" + Search_MatchData_DB.rows[1].matchid +
                            "','" + Search_MatchData_DB.rows[2].matchid + "','" + Search_MatchData_DB.rows[3].matchid + "','" + Search_MatchData_DB.rows[4].matchid + "')");
                        let GraphWin = await query("select n.puuid,n.faction,sum(n.cnt) from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata where game_outcome='win' ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata where game_outcome='win' ) as s group by s.faction,s.puuid) as n where puuid='" + Update_Summoner_DB.rows[0].puuid + "' group by n.faction,n.puuid");
                        let GraphLoss = await query("select n.puuid,n.faction,sum(n.cnt) from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata where game_outcome='loss' ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata where game_outcome='loss' ) as s group by s.faction,s.puuid ) as n where puuid='" + Update_Summoner_DB.rows[0].puuid + "' group by n.faction,n.puuid");
                        let FavoriteFactions = await query("select n.puuid,n.faction,sum(n.cnt) as cnt from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata ) as s group by s.faction,s.puuid) as n where puuid='" + Update_Summoner_DB.rows[0].puuid + "' group by n.faction,n.puuid order by cnt desc limit 2");
                        array.push(Update_Summoner_DB.rows[0]);
                        array.push(Search_MatchData_DB.rows);
                        array.push(Search_MatchList_DB.rows);
                        array.push(GraphWin.rows);
                        array.push(GraphLoss.rows);
                        array.push(FavoriteFactions.rows);
                        resp.send(array);
                    }
                } else {
                    //il dato è aggiornato
                    //Send Array
                    let Summoner_API = await query("select * from LOR_Summoner where name='" + req.query.summoner + "'and region='" + req.query.region + "'");
                    let Search_MatchData_DB = await query("select * " +
                        " from lor_matchdata where puuid='" + Summoner_API.rows[0].puuid + "' order by date desc  limit 5");
                    if (Search_MatchData_DB.rowCount == 0) {
                        let Send_204 = { "status": "204" };
                        resp.send(Send_204);
                    }
                    else if (Search_MatchData_DB.rowCount < 5) {
                        let Send_422 = { "status": "422" };
                        resp.send(Send_422);
                    }
                    else {
                        let Search_MatchList_DB = await query("select *" +
                            "from lor_matchlist where matchId in ('" + Search_MatchData_DB.rows[0].matchid + "','" + Search_MatchData_DB.rows[1].matchid +
                            "','" + Search_MatchData_DB.rows[2].matchid + "','" + Search_MatchData_DB.rows[3].matchid + "','" + Search_MatchData_DB.rows[4].matchid + "')");
                        let GraphWin = await query("select n.puuid,n.faction,sum(n.cnt) from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata where game_outcome='win' ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata where game_outcome='win' ) as s group by s.faction,s.puuid) as n where puuid='" + Summoner_API.rows[0].puuid + "' group by n.faction,n.puuid");
                        let GraphLoss = await query("select n.puuid,n.faction,sum(n.cnt) from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata where game_outcome='loss' ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata where game_outcome='loss' ) as s group by s.faction,s.puuid ) as n where puuid='" + Summoner_API.rows[0].puuid + "' group by n.faction,n.puuid");
                        let FavoriteFactions = await query("select n.puuid,n.faction,sum(n.cnt) as cnt from( select f.puuid,f.faction,count(f.faction) as cnt from ( select puuid,factions_1 as faction from lor_matchdata ) as f group by f.faction,f.puuid union select s.puuid,s.faction,count(s.faction) as cnt from ( select puuid,faction_2 as faction from lor_matchdata ) as s group by s.faction,s.puuid) as n where puuid='" + Summoner_API.rows[0].puuid + "' group by n.faction,n.puuid order by cnt desc limit 2");
                        array.push(Summoner_API.rows[0]);
                        array.push(Search_MatchData_DB.rows);
                        array.push(Search_MatchList_DB.rows);
                        array.push(GraphWin.rows);
                        array.push(GraphLoss.rows);
                        array.push(FavoriteFactions.rows);
                        resp.send(array);
                    }
                }
            }
        } catch (e) { console.log(e); }
    })();
});























app.get('/LOL_LeaderboardCH.html', function (req, resp) {
    resp.sendFile(path.join(__dirname + '/LOL_LeaderboardCH.html'));
});


app.ws('/LeaderboardCH', function (ws, req) {
    ws.on('message', function (msg) {
        let msg1 = JSON.parse(msg);
        if (msg1.game == "lol") {
            let challengerData = fetch('https://'+msg1.region+'.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5?api_key=' + RIOT_KEY)
                .then(function (response) {
                    return response.json();
                }).then(function (chData) {
                    ws.send(JSON.stringify(chData.entries));
                    //ws.close();
                }).catch(function (error) {
                    console.warn(error);
                });
        }
        else if (msg1.game == "tft") {
            let challengerData = fetch('https://'+msg1.region+'.api.riotgames.com/tft/league/v1/challenger?api_key=' + RIOT_KEY)
                .then(function (response) {
                    return response.json();
                }).then(function (chData) {
                    ws.send(JSON.stringify(chData.entries));
                    //ws.close();
                }).catch(function (error) {
                    console.warn(error);
                });
        }
    })
});



app.get('/TFT_LeaderboardCH.html', function (req, resp) {
    resp.sendFile(path.join(__dirname + '/LOL_LeaderboardCH.html'));
});
















































//setup server and make it listen on port:8888 by running locally on localhost
var server = app.listen(8888, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('RPP server listening at http://%s:%s', host, port);
});


//used to parse the region into country name
async function getCountry(region) {
    let country;
    switch (region) {
        case "euw1":
        case "eun1":
        case "tr1":
        case "ru":
            country = "europe";
            break;
        case "jp1":
        case "kr":
            country = "asia";
            break;
        case "na1":
        case "br1":
        case "oc1":
        case "la1":
        case "la2":
            country = "americas";
            break;
    }
    return country;
}

