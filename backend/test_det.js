const {generateReply}=require('./src/services/gemini');
(async()=>{
  try{
    const r1=await generateReply({message:'¿Qué beneficios tengo como Alumni?'});
    console.log('1:'+r1.substring(0,60));
    const r2=await generateReply({message:'¿Tienen descuentos?'});
    console.log('2:'+r2.substring(0,60));
    const r3=await generateReply({message:'¿Cuál es el teléfono de Red Alumni?'});
    console.log('3:'+r3.substring(0,60));
    const r4=await generateReply({message:'¿Todas las prácticas profesionales son remuneradas?'});
    console.log('4:'+r4.substring(0,60));
  }catch(e){
    console.log('ERR', e && e.code ? e.code : 'UNKNOWN');
  }
})();
