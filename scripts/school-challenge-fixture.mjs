/** Local Node-only transport: mirrors challenge semantics without publishing its plan. */
export function createChallengeFixture({createPlan,parseCommand,points}){
 let players=new Map(),requests=[],loseAction=null,offset=0;
 const now=()=>Date.now()+offset;
 const player=owner=>{if(!players.has(owner))players.set(owner,{bestScore:0,bestCorrectCount:0,completedCount:0,round:null,receipts:new Map()});return players.get(owner);};
 const snapshot=(owner,replayed=false)=>{
  const state=player(owner),round=state.round;
  return {version:1,ownerId:owner,serverNow:new Date(now()).toISOString(),bestScore:state.bestScore,bestCorrectCount:state.bestCorrectCount,completedCount:state.completedCount,replayed,
   round:round?{id:round.id,contentVersion:round.plan.contentVersion,status:round.status,questionNumber:round.position+1,totalQuestions:20,level:Math.floor(round.position/5)+1,score:round.score,correctCount:round.correctCount,answeredCount:round.answers.length,openedAt:round.openedAt,question:round.status==='complete'?null:structuredClone(round.plan.questions[round.position].question),feedback:round.status==='feedback'?structuredClone(round.answers[round.position]):null,answers:structuredClone(round.answers)}:null};
 };
 const fail=code=>({status:code==='school_challenge_invalid'?400:409,body:{error:'Action incompatible avec la partie enregistrée.',code}});
 const request=(method,input,owner)=>{
  if(method==='GET')return {status:200,body:snapshot(owner)};
  const command=parseCommand(input);if(!command)return fail('school_challenge_invalid');
  requests.push(structuredClone(command));const state=player(owner),identity=JSON.stringify(command),previous=state.receipts.get(command.requestKey);
  if(previous)return previous!==identity?fail('school_challenge_request_mismatch'):{status:200,body:snapshot(owner,true)};
  let replayed=false;
  if(command.action==='start'){
   if((state.round?.id??undefined)!==command.replaceRoundId)return fail('school_challenge_round_changed');
   state.round={id:command.requestKey,plan:createPlan(),position:0,status:'question',openedAt:new Date(now()).toISOString(),answers:[],score:0,correctCount:0};
  }else{
   const round=state.round;if(!round||round.id!==command.roundId)return fail('school_challenge_round_changed');
   const checked=round.answers.find(answer=>answer.questionId===command.questionId),item=round.plan.questions[round.position],question=item.question;
   if(command.action==='answer'&&checked){if(checked.optionId!==command.optionId)return fail('school_challenge_answer_locked');replayed=true;}
   else if(command.action==='next'&&checked&&(round.status==='complete'||question.id!==command.questionId)){replayed=true;}
   else{
    if(question.id!==command.questionId)return fail('school_challenge_question_changed');
    if(command.action==='answer'){
     if(round.status!=='question'||!question.options.some(option=>option.id===command.optionId))return fail('school_challenge_invalid');
     const correct=command.optionId===item.answer.correctOptionId,elapsedMs=Math.max(0,now()-Date.parse(round.openedAt)),score=points(correct,elapsedMs);
     const feedback={questionId:question.id,optionId:command.optionId,correctOptionId:item.answer.correctOptionId,isCorrect:correct,explanation:item.answer.explanation,optionExplanations:item.answer.optionExplanations,lessonId:question.lessonId,sectionId:question.sectionId,sources:question.sources,buddyCodes:question.buddyCodes,question:structuredClone(question),level:question.level,...score,elapsedMs};
     round.answers.push(feedback);round.score+=score.awardedPoints;round.correctCount+=Number(correct);round.status='feedback';
    }else{
     if(round.status!=='feedback')return fail('school_challenge_answer_required');
     if(round.position===19){round.status='complete';state.completedCount++;state.bestScore=Math.max(state.bestScore,round.score);state.bestCorrectCount=Math.max(state.bestCorrectCount,round.correctCount);}
     else{round.position++;round.status='question';round.openedAt=new Date(now()).toISOString();}
    }
   }
  }
  state.receipts.set(command.requestKey,identity);
  if(loseAction==='any'||loseAction===command.action){loseAction=null;return {aborted:true};}
  return {status:200,body:snapshot(owner,replayed)};
 };
 return {request,snapshot,reset(){players=new Map();requests=[];loseAction=null;offset=0;},loseNext(action='any'){loseAction=action;},advance(milliseconds){offset+=milliseconds;},get submissions(){return requests;}};
}
