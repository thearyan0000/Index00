precision highp float;
uniform sampler2D uDamage;
uniform float uCloth;
uniform sampler2D uH,uP,uC,uI,uMask;uniform vec2 uRes,uL,uM,uImageCenter,uImageSize,uImageFlip;uniform float uImageScale,uImageAngle;uniform float uOnly,uK,uS,uT,uImg,uBl,uTex,uPal,uLab,uFx,uFxStrength,uFxGrain,uFxBleed,uFxWear,uFxExposure,uFxContrast,uFxSoft,uFxBorder,uFxSeed,uFxBefore,uFxMaskActive,uLightPower,uLightSoft,uShadow,uLightType;
float Hr(vec2 u){return texture2D(uH,u).r;}
float H(vec2 u){float v=Hr(u),r=length((u*uRes-uM)/(140.*uK));return v+smoothstep(.04,.14,v)*uS*smoothstep(1.,0.,r)*(.34+.1*sin(r*16.-uT*3.));}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float cem(vec2 p){return .5*vn(p*.02)+.3*vn(p*.09)+.2*vn(p*.45);}
float fb(vec2 p){return .5*vn(p)+.3*vn(p*2.1+vec2(3.7,1.3))+.2*vn(p*4.3+vec2(9.1,5.9));}
float voronoiCracks(vec2 p){
 vec2 i=floor(p),f=fract(p);float best=9.,second=9.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 g=vec2(float(x),float(y)),o=vec2(hash(i+g),hash(i+g+vec2(17.2,9.1)));
  float d=length(g+o*.76+.12-f);if(d<best){second=best;best=d;}else if(d<second)second=d;
 }
 return second-best;
}
vec4 sampleImage(vec2 stageUV){
  vec2 v=(stageUV-uImageCenter)*uRes/max(uImageScale,.00001);
  float c=cos(uImageAngle),s=sin(uImageAngle);
  vec2 local=vec2(c*v.x-s*v.y,s*v.x+c*v.y)*uImageFlip;
  vec2 uv=vec2(.5)+local/max(uImageSize,vec2(1.));
  vec2 margin=min(uv,vec2(1.)-uv)*uImageSize;
  float cover=clamp(min(margin.x,margin.y)+.5,0.,1.);
  vec3 pixel=texture2D(uI,clamp(uv,vec2(0.),vec2(1.))).rgb;
  return vec4(mix(vec3(.0353,.0353,.0471),pixel,cover),cover);
}
void main(){
 float k=uK;vec2 fc=gl_FragCoord.xy,u=fc/uRes,q=fc/k,e=vec2(1.4*k)/uRes;
 // Full-frame darkroom: a separate image-treatment path, independent of the mesh.
  if(uLab>.5){
    // Non-destructive, image-space GPU darkroom. The source photograph is never modified.
    vec2 uv=fc/uRes;
    float strength=uFxStrength,water=uFxBleed,wear=uFxWear,grainAmt=uFxGrain;
    float seed=uFxSeed;
    vec2 ar=vec2(uRes.x/uRes.y,1.0),p=uv*ar;
    float n1=fb(p*vec2(4.9,4.1)+vec2(seed*1.7,2.4));
    float n2=fb(p*vec2(5.6,3.7)+vec2(9.3,seed*2.1));
    vec2 current=(vec2(n1,n2)-.5)*(water*.095);
    vec2 puv=clamp(uv+current,vec2(.001),vec2(.999));
    vec3 source = uImg>.5?sampleImage(uv).rgb:vec3(.11+.38*n1,.105+.39*n2,.12+.35*n1);
    vec3 warped = uImg>.5?sampleImage(puv).rgb:source;
    // Print developer/photographic pigment fronts: offset-domain fbm, sharp tide line, diffuse halo.
    float field=fb(p*vec2(7.4,8.2)+vec2(3.1*n1,3.8*n2)+vec2(seed,seed*.41));
    float field2=fb(p*vec2(12.2,10.1)+vec2(4.8*n2,3.2*n1)+vec2(seed*.53,7.));
    float tide=1.-smoothstep(.008,.065,abs(field-.52));
    float shore=1.-smoothstep(.02,.11,abs(field-.52));
    float pool=smoothstep(.46,.71,field),inner=smoothstep(.59,.83,field2);
    float fibre=texture2D(uC,uv*uRes/512.).r;
    float pr=texture2D(uC,uv*uRes/160.+vec2(seed*.23)).r;
    float fine=hash(floor(fc*.88)+vec2(seed*38.,seed*91.))-.5;
    float specks=step(.9975,hash(floor(fc*.5)+vec2(seed*19.,73.)));
    float flaw=fb(p*vec2(27.,34.)+vec2(seed,19.));
    float edgeD=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
    float edgeOx=1.-smoothstep(.002,.05+wear*.065,edgeD+(n1-.5)*(.023*wear));
    float rimShape=1.-smoothstep(.045,.16,edgeD+(n2-.5)*wear*.03);
    float scratches=(1.-smoothstep(.003,.017,abs(fract(uv.x*135.+n1*.08)-.5)))
      *step(.985,hash(vec2(floor(uv.x*135.),seed*17.)))
      *(smoothstep(.04,.27,uv.y)*smoothstep(1.,.52,uv.y));
    vec3 base=clamp((warped-.5)*( .70+uFxContrast*1.28)+.5+uFxExposure*.39,0.,1.);
    float l=dot(base,vec3(.299,.587,.114));
    vec3 c=base, paper=vec3(.86,.82,.74);
    if(uFx<.5){
      // Photographic negative: reversed silver density, persistent bloom in low-density areas.
      float negative=1.-l;
      c=vec3(negative)*vec3(.82,.9,1.)+vec3(.035,.045,.067);
      c+=vec3(.13,.16,.19)*(1.-shore)*n1;
      c=mix(c,vec3(.84,.89,.9),shore*.20*water);
      c-=tide*.075*wear;
    }else if(uFx<1.5){
      // Wet collodion: silver sheen, uneven hand-coated plate, faded periphery.
      float sil=pow(smoothstep(.10,.86,l),.91);
      c=mix(vec3(.028,.039,.046),vec3(.88,.85,.78),sil);
      c=mix(c,vec3(.29,.33,.32),shore*water*.20);
      c*=1.-edgeOx*.45*wear;
    }else if(uFx<2.5){
      // Pigment migrating through a wet emulsion, with turbid tide lines.
      vec3 indigo=vec3(.09,.18,.30),ochre=vec3(.79,.39,.26),salmon=vec3(.79,.59,.62);
      vec3 dye=mix(indigo,ochre,smoothstep(.30,.79,field));
      dye=mix(dye,salmon,smoothstep(.57,.86,field2)*.56);
      c=mix(base,base*.37+dye*.63,water*.84);
      c=mix(c,dye,pool*(.27+.49*water));
      c-=tide*(.05+.20*water);c+=shore*.08*water;
    }else if(uFx<3.5){
      // Cyanotype: iron blue density with slightly greenish high-exposure bleed.
      vec3 deep=vec3(.018,.053,.14),prussian=vec3(.055,.22,.52),ice=vec3(.28,.72,.85);
      c=mix(deep,prussian,smoothstep(.04,.67,l));
      c=mix(c,ice,smoothstep(.61,.99,l)*.73);
      c=mix(c,c*vec3(.58,.88,.92),pool*water*.32);
      c+=vec3(.025,.055,.04)*shore*water;
    }else if(uFx<4.5){
      // Cross processing: irreconcilable color-layer development.
      vec3 c1=mix(vec3(.055,.082,.15),vec3(.70,.22,.31),smoothstep(.12,.61,l));
      c1=mix(c1,vec3(1.,.73,.40),smoothstep(.5,.99,l)*.87);
      c=mix(base*.57,c1,.68);c+=vec3(.08,-.025,.03)*(n1-.5);
    }else if(uFx<5.5){
      // Reticulation: cell walls separate as gelatin contracts.
      float crack=1.-smoothstep(.012,.077,voronoiCracks(p*(17.+water*21.)+current*40.));
      c=mix(vec3(.045,.051,.057),vec3(.76,.78,.72),pow(l,.84));
      c=mix(c,vec3(.034,.073,.072),crack*(.5+.5*wear));
      c=mix(c,paper,inner*wear*.20);
    }else if(uFx<6.5){
      // Film stock burned from an edge, incandescent bloom and organic scratches.
      vec2 split=vec2(.004,.0009)*water;
      vec3 shiftR=uImg>.5?sampleImage(clamp(uv+split,vec2(0.),vec2(1.))).rgb:base;
      vec3 shiftB=uImg>.5?sampleImage(clamp(uv-split,vec2(0.),vec2(1.))).rgb:base;
      c=vec3(shiftR.r,base.g,shiftB.b)*vec3(1.04,.91,.85);
      float leak=pow(1.-smoothstep(.03,.7,length((uv-vec2(.00,.88))*vec2(1.1,.86)+vec2((field-.5)*.15,0.))),2.4);
      c=mix(c,vec3(.99,.31,.095),leak*(.42+.48*water));
      c+=vec3(.8,.23,.11)*pow(max(l-.65,0.),.8)*.35;
      c+=scratches*.28;
    }else if(uFx<7.5){
      // Sabattier threshold inversion of partially exposed highlights.
      float sol=mix(l,1.-l,smoothstep(.36,.79,l));
      c=vec3(sol)*vec3(.91,.89,.86);
      c+=vec3(.19,.13,.09)*(1.-smoothstep(.02,.10,abs(l-.53)))*water;
      c-=tide*.12*wear;
    }else if(uFx<8.5){
      // Archival print: baryta base yellowing, silver fading and local oxidation.
      paper=vec3(.87,.82,.69);
      c=mix(vec3(.15,.13,.12),paper,pow(l,.64));
      c=mix(c,paper,field2*water*.21);
      c-=tide*.055*wear;
    }else if(uFx<9.5){
      // Chromatic registration slip / ghost of a misaligned color layer.
      vec2 delta=vec2(.0045,-.0025)*(water+.1);
      vec3 a=uImg>.5?sampleImage(clamp(uv+delta,vec2(.001),vec2(.999))).rgb:base;
      vec3 b=uImg>.5?sampleImage(clamp(uv-delta*1.4,vec2(.001),vec2(.999))).rgb:base;
      c=vec3(a.r,base.g,b.b);
      c=mix(c,vec3(.02,.13,.46)+c*vec3(.15,.47,.96),.51);
      c+=vec3(.14,.01,.05)*inner*water;
    }else if(uFx<10.5){
      // Chemical bleaching: near-white photograph with denser unbleached remnants.
      c=mix(vec3(.98,.977,.94),vec3(.065,.13,.11),1.-smoothstep(.09,.60,l));
      c=mix(c,base,smoothstep(.65,.95,l)*.23);
      c-=vec3(.07,.02,.05)*tide*wear;
      c+=specks*.08;
    }else if(uFx<11.5){
      // Soot and smoke trapped in emulsion.
      c=mix(vec3(.012,.016,.021),vec3(.68,.67,.64),pow(l,1.3));
      c=mix(c,vec3(.31,.17,.36),pool*water*.45);
      c-=shore*.18*wear;
    }else if(uFx<12.5){
      // Chemigram: solvent-resist islands, oxidized liquid edges and clear chemical halos.
      vec3 tarnish=mix(vec3(.085,.14,.16),vec3(.65,.72,.60),smoothstep(.27,.77,l));
      vec3 corrode=mix(vec3(.13,.28,.34),vec3(.92,.54,.30),smoothstep(.38,.8,field2));
      c=mix(tarnish,corrode,pool*(.3+.45*water));
      c-=vec3(.23,.13,.07)*tide*(.26+.65*water);
      c+=vec3(.12,.22,.23)*shore*.25;
      c=mix(c,paper,smoothstep(.72,.91,field)*wear*.37);
    }else if(uFx<13.5){
      // Lumen print: solar-oxidized silver paper, peach/lilac botanical tones.
      vec3 dark=vec3(.18,.16,.22),warm=vec3(.82,.63,.53),lilac=vec3(.66,.52,.71);
      c=mix(dark,warm,smoothstep(.02,.92,l));
      c=mix(c,lilac,pool*(.24+.4*water));
      c=mix(c,paper,smoothstep(.5,.95,l)*.14);
    }else if(uFx<14.5){
      // Water-damaged baryta: soft-edged washouts and descending fibrous streaks.
      float tear=fb(p*vec2(7.5,3.7)+vec2(n1*3.4,seed));
      float lost=smoothstep(.49,.67,tear+n2*.13)*(.4+.58*water);
      c=mix(base,paper,lost);
      c-=vec3(.22,.18,.18)*(1.-smoothstep(.03,.12,abs(tear-.55)))*wear*.4;
      c=mix(c,vec3(.27,.23,.29),pool*wear*.23);
    }else if(uFx<15.5){
      // Two slightly displaced frames, like a haunted long exposure.
      vec2 shift=vec2(.029,-.014)*(water+.18);
      vec3 ghost=uImg>.5?sampleImage(clamp(uv+shift+current*.4,vec2(.001),vec2(.999))).rgb:source;
      c=mix(base,ghost,.39+.19*water);
      c=mix(c,vec3(l*.61,l*.83,l*1.14),.50);
      c+=vec3(.03,.08,.15)*shore*water;
    }else if(uFx<16.5){
      // Traditional black-and-white silver emulsion, shadow-rich baryta base.
      float bw=pow(smoothstep(.055,.90,l),.97);
      c=mix(vec3(.025,.029,.03),vec3(.92,.91,.86),bw);
      c-=vec3(.09)*tide*wear*.4;
    }else if(uFx<17.5){
      // Photogram: milky paper and contact shadow with a fine glowing contour.
      float cut=smoothstep(.24,.68,l);
      c=mix(vec3(.08,.14,.19),vec3(.95,.96,.92),cut);
      float contour=1.-smoothstep(.013,.085,abs(l-.45));
      c+=vec3(.18,.25,.25)*contour*(.3+.5*water);
    }else{
      // Oil canvas: image-adaptive painterly averaging, woven ground and subtle impasto.
      vec2 px=vec2(1.0)/uRes;
      vec3 sxp=uImg>.5?sampleImage(clamp(puv+vec2(px.x*2.0,0.0),vec2(.001),vec2(.999))).rgb:warped;
      vec3 sxm=uImg>.5?sampleImage(clamp(puv-vec2(px.x*2.0,0.0),vec2(.001),vec2(.999))).rgb:warped;
      vec3 syp=uImg>.5?sampleImage(clamp(puv+vec2(0.0,px.y*2.0),vec2(.001),vec2(.999))).rgb:warped;
      vec3 sym=uImg>.5?sampleImage(clamp(puv-vec2(0.0,px.y*2.0),vec2(.001),vec2(.999))).rgb:warped;
      float gx=dot(sxp-sxm,vec3(.299,.587,.114));
      float gy=dot(syp-sym,vec3(.299,.587,.114));
      vec2 dir=normalize(vec2(gx,gy)+vec2(.0001,.00013));
      vec2 perp=vec2(-dir.y,dir.x);
      vec2 sA=dir*(.0035+.0055*strength);
      vec2 sB=perp*(.0025+.0045*strength);
      vec3 a0=uImg>.5?sampleImage(clamp(puv-sA*1.25,vec2(.001),vec2(.999))).rgb:warped;
      vec3 a1=warped;
      vec3 a2=uImg>.5?sampleImage(clamp(puv+sA*1.25,vec2(.001),vec2(.999))).rgb:warped;
      vec3 b0=uImg>.5?sampleImage(clamp(puv-sB*1.6,vec2(.001),vec2(.999))).rgb:warped;
      vec3 b1=uImg>.5?sampleImage(clamp(puv+sB*1.6,vec2(.001),vec2(.999))).rgb:warped;
      vec3 avg=(a0+a1+a2+b0+b1)/5.0;
      vec3 avg2=(base+avg)/2.0;
      float detail=clamp(length(vec2(gx,gy))*7.5,0.0,1.0);
      float wx=sin((uv.x*uRes.x)*(2.9+.35*n1)+field*5.2);
      float wy=sin((uv.y*uRes.y)*(2.6+.28*n2)+field2*4.7);
      float weave=(wx*wy)*0.5+0.5;
      float cross=(sin(uv.x*uRes.x*6.8+field*6.2831)*sin(uv.y*uRes.y*6.4+field2*6.2831))*0.5+0.5;
      float impasto=(.35+.65*detail)*(.4+.6*weave);
      vec3 coolGrey=mix(vec3(.84,.86,.90),vec3(.56,.61,.69),pow(1.-l,.75));
      c=mix(avg2,avg,clamp(strength*.18+.44,0.,.92));
      c=mix(c,coolGrey,.18+.12*water);
      c+=vec3((weave-.5)*(.08+.08*wear));
      c+=vec3((cross-.5)*(.04+.05*water));
      c+=vec3(impasto)*vec3(.07,.075,.08);
      c=mix(c,c*.78+paper*.22,shore*.11*water);
      c=mix(c,c*.92+vec3(.16,.16,.14)*detail,.18+.18*strength);
      c=clamp(c,0.,1.);
    }
    // Physical print support: static silver particles, granulation, fibre and abrasion.
    float grain = (fine*.21 + (pr-.5)*.18)*( .3+.7*grainAmt);
    grain *= .50+1.6*l*(1.-l); // clumped silver is more conspicuous in midtones
    c += vec3(grain*grainAmt + (fibre-.5)*wear*.10);
    c += vec3(specks*(.06+.24*wear)-scratches*.1*wear);
    c=mix(c,c*vec3(.63,.57,.54)+vec3(.034,.027,.022),rimShape*wear*.32);
    c=mix(c,vec3(.14,.12,.10),edgeOx*wear*.28);
    // Authentic irregular, optical vignette independent of canvas aspect ratio.
    float vignette=dot((uv-.5)*vec2(.9,.8),(uv-.5)*vec2(.9,.8));
    c *= 1.-vignette*(.18+.3*wear);
    c=clamp(c,0.,1.);
    // Optical bloom: four nearby image samples, applied only when requested.
    if(uFxSoft>.001){
      vec2 off=vec2(.003,.003)*(.25+uFxSoft*2.3);
      vec3 blur=(sampleImage(clamp(puv+off,vec2(.001),vec2(.999))).rgb+
                 sampleImage(clamp(puv-off,vec2(.001),vec2(.999))).rgb+
                 sampleImage(clamp(puv+off*vec2(1.,-1.),vec2(.001),vec2(.999))).rgb+
                 sampleImage(clamp(puv+off*vec2(-1.,1.),vec2(.001),vec2(.999))).rgb)*.25;
      float bright=dot(blur,vec3(.299,.587,.114));
      c=mix(c,c*.73+vec3(bright)*.27,uFxSoft*.42);
      c+=vec3(.10,.12,.14)*pow(max(bright-.48,0.),1.3)*uFxSoft;
    }
    // Receding wet-paper border: configurable, softly deckled, no imported bitmap.
    if(uFxBorder>.001){
      float bw=uFxBorder*.075;
      float irregular=bw+(n1-.5)*bw*.42+(fibre-.5)*.006;
      float printMask=smoothstep(irregular-.004,irregular+.006,edgeD);
      vec3 sheet=paper+vec3((fibre-.5)*.12);
      c=mix(sheet,c,printMask);
      c=mix(c,vec3(.30,.30,.30),(.6+wear*.35)*(.1*(1.-smoothstep(.002,.011,abs(edgeD-irregular)))));
    }
    float brushMask=uFxMaskActive>.5?texture2D(uMask,uv).r:1.;
    float amount=clamp(strength*brushMask*(1.-uFxBefore),0.,1.);
    gl_FragColor=vec4(mix(source,c,amount),1.);return;
  }

 vec3 damage=texture2D(uDamage,u).rgb;
 vec2 de=vec2(2.*k)/uRes;
 vec2 pull=vec2(texture2D(uDamage,u+vec2(de.x,0.)).g-texture2D(uDamage,u-vec2(de.x,0.)).g,
                texture2D(uDamage,u+vec2(0.,de.y)).g-texture2D(uDamage,u-vec2(0.,de.y)).g);
 vec3 folds=(uCloth>.5||uImg>.5)?clothFolds(q):vec3(0.);
 vec2 slope=folds.xy+pull*2.4;
 vec3 clothNormal=normalize(vec3(-slope,1.));
 vec2 weaveQ=q+folds.xy*8.+pull*5.;
 float h=H(u);
 vec3 n=normalize(vec3(-(H(u+vec2(e.x,0.))-H(u-vec2(e.x,0.)))*3.2,-(H(u+vec2(0.,e.y))-H(u-vec2(0.,e.y)))*3.2,1.)+vec3(-slope,0.));
 vec2 d2=uL-fc;float dl=length(d2)+1.;vec2 dir=d2/dl;
 vec3 L=normalize(vec3(d2,mix(170.,95.,step(1.5,uLightType))*k));
 vec2 bp=fc/uRes.y-vec2(.5*uRes.x/uRes.y,.5)+vec2((uL.x/uRes.x-.3)*.25,0.);
 float bd=dot(bp,normalize(vec2(-.62,.78)));
 float band=.04+uLightSoft*.18;
 float beam=(1.-smoothstep(band,band*2.4,abs(bd)))+.5*(1.-smoothstep(band*.55,band*1.5,abs(bd-.43)))+.35*(1.-smoothstep(band*.4,band*1.2,abs(bd+.47)));
 float pointPool=.4*exp(-pow(dl/(uRes.y*.35),2.));
 float source=pointPool+.6*beam;
 if(uLightType>.5&&uLightType<1.5)source=pointPool*.16+1.25*beam;
 else if(uLightType>1.5)source=pointPool*.7+.9*beam;
 float pool=.12+uLightPower*source;
 float tanE=clamp(170.*k/dl,.3,2.5);
 float sh=0.,base=Hr(u)*12.*k;
 for(int i=1;i<=6;i++){float t=float(i)*2.6*k;float hh=Hr(u+dir*t/uRes)*12.*k;sh=max(sh,smoothstep(-uLightSoft*1.4*k,2.5*k+uLightSoft*3.*k,hh-base-t*tanE));}sh=clamp(sh*uShadow,0.,1.);
 float ao=0.;for(int i=0;i<4;i++){float a=float(i)*1.571;ao+=Hr(u+vec2(cos(a),sin(a))*6.*k/uRes);}ao/=4.;
 vec3 dye=vec3(1.),paletteTint=vec3(.8,.66,.6);
 if(uPal>.5&&uPal<1.5){dye=vec3(.82,.84,1.12);paletteTint=vec3(.56,.5,.88);}
 else if(uPal>1.5&&uPal<2.5){dye=vec3(.82,1.04,.94);paletteTint=vec3(.42,.76,.64);}
 else if(uPal>2.5&&uPal<3.5){dye=vec3(.66,.85,1.35);paletteTint=vec3(.23,.48,.9);}
 else if(uPal>3.5&&uPal<4.5){dye=vec3(1.35,1.05,.62);paletteTint=vec3(.9,.64,.25);}
 else if(uPal>4.5&&uPal<5.5){dye=vec3(1.38,.74,.56);paletteTint=vec3(.78,.31,.17);}
 else if(uPal>5.5&&uPal<6.5){dye=vec3(1.32,.68,.84);paletteTint=vec3(.66,.25,.39);}
 else if(uPal>6.5){dye=vec3(.8,.94,1.17);paletteTint=vec3(.45,.59,.72);}
 vec2 cu=q/460.;float c0=texture2D(uC,cu).r;vec3 gr=vec3(.35,.33,.36)*(.55+.9*c0)*dye;
 vec3 gn=normalize(vec3((c0-texture2D(uC,cu+vec2(.0032,0.)).r)*9.,(c0-texture2D(uC,cu+vec2(0.,.0032)).r)*9.,1.));
 float lit=(.3+max(dot(gn,L),0.)*1.1)*pool*(1.-.82*sh);
 vec4 ph=texture2D(uP,u);
 float fs=max(texture2D(uP,u+dir*9.*k/uRes).a,texture2D(uP,u+dir*18.*k/uRes).a*.7)*(1.-ph.a);
 vec4 imageSample=sampleImage(u+(folds.xy*8.+pull*5.)*k/uRes);
 vec3 im=imageSample.rgb;
 vec3 g=mix(uImg>.5?im*(.8+.34*(pool-.13)*(1.-.5*sh)):gr*lit,ph.rgb*(.35+.8*pool*(1.-.75*sh)),ph.a)*(1.-.5*fs)*(1.-.65*ao);
 if(uCloth>.5){
   vec3 plainCloth=shadeFabric(weaveQ,clothNormal,L,im,0.,pool,sh);
   vec3 printedCloth=shadeFabric(weaveQ,clothNormal,L,im,1.,pool,sh);
   g=mix(plainCloth,printedCloth,uImg*imageSample.a);
 }else if(uImg>.5){g*=.65+.35*max(dot(clothNormal,L),0.);}
 // Needle depressions shade locally; rare split yarns reveal the layer below.
 g*=1.-damage.g*.10;
 g=mix(g,vec3(.025,.018,.02),damage.r*.42);
 g+=vec3(.52,.45,.33)*damage.b*.13;
 float m=smoothstep(.05,.15,h);
 float fib=.5;if(m>.01)fib=.5*vn(q*1.3)+.5*vn(q*.4);
 vec3 al=vec3(.93,.88,.88)*(.8+.28*fib)*(.94+.06*sin(q.x*1.9)*sin(q.y*1.9));
 al*=dye;
 float dif=max(dot(n,L),0.);
 float sp=pow(max(dot(n,normalize(L+vec3(0.,0.,1.))),0.),34.);
 vec3 col=al*(.4+dif*pool*(1.-.55*sh)*1.05)+vec3(1.,.96,.95)*sp*.3*pool*(1.-sh);
 float coverage=m*uBlendOpacity;
 if(uBl>.5&&uBl<1.5)coverage=coverage<=0.?0.:coverage>=1.?1.:step(hash(floor(q)+vec2(19.1,7.3)),coverage);
 if(uOnly>.5){gl_FragColor=vec4(col*coverage,coverage);return;}
 vec3 o=mix(g,blendRGB(g,col,uBl),coverage);
 float lum0=dot(o,vec3(.3,.59,.11));
 vec3 tint=paletteTint;
 if(uTex>.5&&uTex<1.5){
  // film grain: clumped silver crystals, strongest in the mids, re-rolled about 11x a second
  vec2 gs=floor(uT*11.)*vec2(17.3,9.7);
  float gn1=hash(floor(q*1.15)+gs),gn2=vn(q*.7+gs*.37);
  float gv=(gn1-.5)*.36+(gn2-.5)*.22;
  o=mix(o,vec3(lum0),.2)+gv*(.45+1.2*lum0*(1.-lum0));
 }else if(uTex>1.5&&uTex<2.5){
  // moire: two fine line gratings a couple of degrees apart; the second one bends over the lace relief
  float tph=uT*.12;
  vec2 dA=vec2(.9397,.342),dB=vec2(.9252,.3796);
  float ma1=sin(dot(q,dA)*1.38+tph),mb1=sin((dot(q,dB)+14.*sin(q.x*.0045+q.y*.0032+tph*.5)+h*18.)*1.38);
  float mo=.5+.5*ma1*mb1;
  o*=.6+.75*mo;
  o+=tint*.04*(mo-.5);
 }else if(uTex>2.5&&uTex<3.5){
  // chemigram: warped developer stains with dark tide lines, pale halos and crystal specks
  vec2 cp=q*.0075;
  vec2 wv=vec2(fb(cp*1.3+vec2(3.1,1.7)),fb(cp*1.3+vec2(8.4,5.2)));
  float cf=fb(cp+2.2*(wv-.5)+h*.12);
  float rim=smoothstep(.028,0.,abs(cf-.52))+.6*smoothstep(.02,0.,abs(cf-.66));
  float stain=smoothstep(.42,.62,cf);
  o=mix(o,tint*(.35+1.2*lum0),stain*.5);
  o*=1.-.38*rim;
  o+=tint*.15*smoothstep(.015,0.,abs(cf-.58));
  o+=vec3(.9)*step(.992,hash(floor(q*.7)))*smoothstep(.45,.6,cf)*(1.-smoothstep(.62,.7,cf))*.35;
 }
 o*=1.-(uCloth>.5?.14:uImg>.5?.22:.55)*pow(length(u-.5)*1.25,2.);
 float lm=dot(o,vec3(.3,.59,.11));
 if(uCloth<.5)o*=mix(vec3(.9,.88,1.08),vec3(1.1,1.,.97),smoothstep(.04,.55,lm));
 o=o/(1.+o*.12);
 // Thread bridges a genuine transparent puncture in the cloth/image below it.
 float clothAlpha=1.-smoothstep(.3,.9,damage.r)*(1.-coverage);
 gl_FragColor=vec4(o*clothAlpha,clothAlpha);
}
