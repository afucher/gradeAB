'use strict';
var schedAPI = require('./schedAPI');
var _ = require("underscore");
var handlebars = require("handlebars");
var fs = require('fs');
const minutesSpace = 5;
const startHour = "08:00"
const endHour = "19:00"
var allSchedules = createHourIntervals(startHour, endHour,minutesSpace);

/** Retorna as informações do sched e gera os grids em html */
schedAPI.getSessionExport((err,session) => {
  generateGrid(processSessionInfo(session))
})


//*********************************************************
//*********************************************************

function processSessionInfo(sessionList){
  var venues = getVenues(sessionList);
  var sessionsByDay = segregateSessionsByDay(sessionList);
  var schedulesByDay = [];

  schedulesByDay = sessionsByDay.map(function(sessionDay, index){
    return {  day : sessionDay.day,
              scheduleList : sortBySchedule(sessionDay.sessionList) ,
              venues : venues
     };
  });
  schedulesByDay.forEach(function(schedulesOfDay,index){
    schedulesByDay[index] = fitSessionsInGrid(schedulesOfDay);
  })

  return schedulesByDay;
}

function sortBySchedule(sessionList){
var sessionListSorted = allSchedules.map((schedule)=> {return {schedule:schedule,sessions:[]}});

  sessionList.forEach(function(session){
    let sessionSchedule
    if(session.active == "Y")
      sessionSchedule = _.findWhere(sessionListSorted, {schedule:session.event_start_time} );
    if(sessionSchedule){
      sessionSchedule.sessions.push(
        {
          name: session.name,
          venue: session.venue,
          event_subtype: session.event_subtype,
          event_type : session.event_type,
          rowspan: sessionListSorted.findIndex(x => x.schedule==session.event_end_time) - sessionListSorted.findIndex(x => x.schedule==session.event_start_time),
          colspan: 1
        }
      );
    }else{
      //console.log(session);
    }

  });

  return sessionListSorted;
}

function fitSessionsInGrid(schedulesOfDay){
var venuesCtrl = [];
  //schedulesOfDay.venues.forEach((venue) => venuesCtrl[venue] = 1);
  schedulesOfDay.venues.forEach((venue) => venuesCtrl.push({name:venue, ocupationNumber: 1}));
  schedulesOfDay.scheduleList.forEach(function(schedule){
    let sessions = schedule.sessions;
    venuesCtrl.forEach((venue) => venue.ocupationNumber--);
      if(sessions.length == 3 && !_.every(venuesCtrl, (num) => num.ocupationNumber == 0 )){
        console.log("Tem algo de errado");
        throw "Erro";
      }
      sessions.forEach(function(session){
        if(isForAll(session)){
          //schedulesOfDay.venues.forEach((venue) => venuesCtrl[venue]+= session.rowspan);
          venuesCtrl.forEach((venue) => venue.ocupationNumber+= session.rowspan);
          session.colspan = schedulesOfDay.venues.length;
        }else{
          let venue = _.findWhere(venuesCtrl, {name: session.venue});
          if(venue){
            venue.ocupationNumber+= session.rowspan;
          }else{
            console.log(venue);
            console.log(session);            
          }
          
          //venuesCtrl[session.venue] += session.rowspan;
        }
      });

      venuesCtrl.forEach(function(venue,index){
        if(venue.ocupationNumber == 0){
          let emptySession = {
            name : "--",
            venue : venue.name,
            colspan : 1,
            rowspan : 1
          };
        sessions.splice(index, 0, emptySession);
        venue.ocupationNumber++;
      }
    });
  });
  var lastIndexSchedule = 0;
  var scheduleList = schedulesOfDay.scheduleList.slice();
  var indexToBeRemoved = [];
  var allEmpty = false;
  scheduleList.forEach((schedule,index)=>{
    if(schedule.sessions.length == 0){
      if(isForAll(schedulesOfDay.scheduleList[lastIndexSchedule].sessions[0])){
        schedulesOfDay.scheduleList[lastIndexSchedule].sessions[0].rowspan--;
        indexToBeRemoved.push(index);
      }

    }else{
      if(schedule.sessions.length == schedulesOfDay.venues.length && _.every(schedule.sessions, (session) => session.name == "--" )){
        if(allEmpty){
          indexToBeRemoved.push(index);
        }
        allEmpty = true;
      }else{
        allEmpty = false;
      }
      lastIndexSchedule = index;
    }
  });
  indexToBeRemoved.reverse().forEach((index)=>schedulesOfDay.scheduleList.splice(index, 1));
  return schedulesOfDay;
}


function segregateSessionsByDay(sessionList){
var sessionsByDay = [];
  sessionList.forEach(function (session){
    let sessionDay = _.findWhere(sessionsByDay, {day: session.start_date});
    //Se não existe o dia ainda, cria
    if(!sessionDay){
      let len = sessionsByDay.push({
        day : session.start_date,
        sessionList : []
      });

      sessionDay = sessionsByDay[len-1];
    }
    sessionDay.sessionList.push(session);
  });
  return sessionsByDay;
}

/** Encontra todas os locais de palestras, e remove o Foyer */
function getVenues(sessionList){
  var venues = sessionList.reduce(function(prev,curr,index,arr){
    if(prev.indexOf(curr.venue) < 0){
      prev.push(curr.venue);
    }
    return prev;
  },[]);

  let index = venues.indexOf('Foyer');
  if (index > -1){
    venues.splice(index, 1);
  }

  return venues;
}

/** Verifica se a sessão é para todos */
function isForAll(session){
  var has = false;
  var sessionName = session.name.toUpperCase();
  
  //Primeiro verificamos pelo nome, foi a única informação que consegui pegar
  ["Agile Alliance Brasil: Reunião Membros","COFFEE BREAK","ALMOÇO","Open Space - Traga suas Ideias!","ABERTURA","Recepção e Welcome Coffee","KEYNOTE","ENCERRAMENTO","RECEPÇÃO"].forEach((str) => {
    has = has || sessionName.trim() === str.toUpperCase();
  });
  //Se for keynote e não for do WBMA também é para todos
  has = has || ((session.event_subtype == "Keynote" || session.event_subtype == "keynote fora da caixa") && session.event_type !== "WBMA");
  return has;
}

/** Gera o html com o grid final baseado no template */
function generateGrid(schedulesByDay){
//var venues = sessionsInfo.venues;
  fs.access('./out', function(err){
    if(err) fs.mkdirSync('./out');

    schedulesByDay.forEach(function(valor){
      fs.readFile('./template/grid.html', 'utf-8', function(error, source){
        var template = handlebars.compile(source);
        var html = template(valor);
        
        fs.writeFile('./out/index'+valor.day+'.html', html, (err) => {
          if (err) throw err;
        });
      });
    });


  });

}





function createHourIntervals(from, until, interval){
    //"01/01/2001" is just an arbitrary date
    var until = Date.parse("01/01/2001 " + until);
    var from = Date.parse("01/01/2001 " + from);
    
    var max = (Math.abs(until-from) / (60*60*1000))*60/interval;
    var time = new Date(from);
    var intervals = [];
    for(var i = 0; i <= max; i++){
        //doubleZeros just adds a zero in front of the value if it's smaller than 10.
        var hour = doubleZeros(time.getHours());
        var minute = doubleZeros(time.getMinutes());
        intervals .push(hour+":"+minute);
        time.setMinutes(time.getMinutes()+interval);
    }
    return intervals;

    function doubleZeros(number){
      return number >= 10 ? number : '0' + number;
    }
}
