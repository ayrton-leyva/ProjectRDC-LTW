const { Client } = require('pg');

const client = new Client({
    user: 'test',
    host: 'localhost',
    database: 'testdb',
    password: 'test',
    port: 5432,
});

client.connect();

//////////Dobbiamo settare la ricerca in API di puuid e name/////////////
const LOR_Summoner = `CREATE TABLE LOR_Summoner (region varchar(10),id varchar(100),puuid varchar(100),name varchar(30),revisionDate bigint,summonerLevel int,PRIMARY KEY(region,name));`;

const LOR_MatchData = 'CREATE TABLE LOR_MatchData (puuid varchar(100),matchId varchar(50),deck_code varchar(150),factions_1 varchar(30),faction_2 varchar(30),game_outcome varchar(5),order_of_play int,date timestamp,PRIMARY KEY(puuid,matchId))';
// //risultati della matchlist di lor escono in ordine dal primo match all ultimo uscito

const LOR_MatchList = "CREATE TABLE LOR_MatchList (matchId varchar(50),game_type varchar(20),player_1_puuid varchar(100),player_2_puuid varchar(100),date timestamp,PRIMARY KEY(matchId));";

// //////////LOL//////////

const LOL_Summoner = `CREATE TABLE LOL_Summoner (region varchar(10),id varchar(100),puuid varchar(100),name varchar(30),revisionDate bigint,summonerLevel int,PRIMARY KEY(region,name));`;

const LOL_League = "CREATE TABLE LOL_League (queueType varchar(30),tier varchar(20),rank varchar(5),id varchar(100),name varchar(30),leaguePoints int,wins int,losses int,veteran boolean,inactive boolean,freshBlood boolean,hotStreak boolean,PRIMARY KEY(id));";

const LOL_MatchData = "CREATE TABLE LOL_MatchData (puuid varchar(100),matchId varchar(30)," +
    "assist int,deaths int,kills int,championName varchar(15),champLevel int," +
    "goldEarned int,lane varchar(25),magicDamageDealt int,physicalDamageDealt int,totalDamageDealt int,trueDamageDealt int,turretKills int,visionScore int,win boolean,teamId int,date timestamp,PRIMARY KEY(puuid,matchId,championName,teamId));";

const LOL_MatchList = "CREATE TABLE LOL_MatchList (matchId varchar(30),gameDuration int,gameMode varchar(30),gameType varchar(20),gameVersion varchar(20),mapId int," +
    "A_name_1 varchar(100),A_name_2 varchar(100),A_name_3 varchar(100),A_name_4 varchar(100)," +
    "A_name_5 varchar(100),B_name_1 varchar(100),B_name_2 varchar(100)," +
    "B_name_3 varchar(100),B_name_4 varchar(100),B_name_5 varchar(100),date timestamp,PRIMARY KEY(matchId));";

// //////////TFT//////////

const TFT_Summoner = "CREATE TABLE TFT_Summoner (region varchar(10),id varchar(100),puuid varchar(100),name varchar(30),revisionDate bigint,summonerLevel int, PRIMARY KEY(region,name));";

const TFT_League = "CREATE TABLE TFT_League (queueType varchar(15),tier varchar(15),rank varchar(5),id varchar(100),name varchar(30),leaguePoints int,wins int,losses int,veterans boolean,inactive boolean,freshBlood boolean,hotStreak boolean,PRIMARY KEY(id));";

const TFT_MatchData = "CREATE TABLE TFT_MatchData (puuid varchar(100),matchId varchar(30),gold_left int,last_round int,level int,placement int,players_eliminated int,total_damage_to_players int,date timestamp,PRIMARY KEY(puuid,matchId));";

const TFT_MatchList = "CREATE TABLE TFT_MatchList (matchId varchar(30),game_length bigint,game_version varchar(75)," +
    "puuid_1 varchar(100),puuid_2 varchar(100),puuid_3 varchar(100),puuid_4 varchar(100)," +
    "puuid_5 varchar(100),puuid_6 varchar(100),puuid_7 varchar(100),puuid_8 varchar(100),date timestamp,PRIMARY KEY(matchId));";

////////////Setup_LOL/////////

client.query(LOL_Summoner).then(res => { console.log('Table LOL_Summoner is successfully created'); }).catch(err => { console.error(err); })

client.query(LOL_League).then(res => { console.log('Table LOL_League is successfully created'); }).catch(err => { console.error(err); })

client.query(LOL_MatchData).then(res => { console.log('Table LOL_MatchData is successfully create'); }).catch(err => { console.log(err); })

client.query(LOL_MatchList).then(res => { console.log('Table LOL_MatchList is successfully created'); }).catch(err => { console.error(err); })

//////////Setup_LOR//////////

client.query(LOR_Summoner).then(res => { console.log('Table LOR_Summoner is successfully created'); }).catch(err => { console.error(err); })

client.query(LOR_MatchData).then(res => { console.log('Table LOR_MatchData is successfully created'); }).catch(err => { console.error(err); })

client.query(LOR_MatchList).then(res => { console.log('Table LOR_MatchList is successfully created'); }).catch(err => { console.error(err); })

//////////Setup_TFT//////////

client.query(TFT_Summoner).then(res => { console.log('Table TFT_Summoner is successfully created'); }).catch(err => { console.error(err); })

client.query(TFT_League).then(res => { console.log('Table TFT_League is successfully created'); }).catch(err => { console.error(err); })

client.query(TFT_MatchData).then(res => { console.log('Table TFT_MatchData is successfully created'); }).catch(err => { console.error(err); })

client.query(TFT_MatchList).then(res => { console.log('Table TFT_MatchList is successfully created'); }).catch(err => { console.error(err); }).finally(() => { client.end(); })