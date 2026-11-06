uniform sampler2D uFabricColor,uFabricDetail;
uniform float uWrinkleAmount,uWrinkleScale,uWrinkleAngle,uWrinkleStyle,uWeaveScale,uBlendOpacity;

// Analytic fold slopes: no extra height-map readbacks and no animation shimmer.
// Components have different directions, wavelengths and curvature so cloth
// does not look like a regular sinusoidal grating.
vec3 clothFolds(vec2 p){
 float angle=uWrinkleAngle,cs=cos(angle),sn=sin(angle);
 mat2 rot=mat2(cs,sn,-sn,cs);vec2 v=rot*p;
 float scale=mix(.006,.027,uWrinkleScale),amount=uWrinkleAmount;
 float stiffness=uCloth>2.5&&uCloth<3.5?.65:uCloth>3.5&&uCloth<4.5?1.25:1.;
 vec2 grad=vec2(0.);float z=0.;
 for(int i=0;i<4;i++){
   float fi=float(i),a=fi*1.17+.25*sin(fi*3.1);
   vec2 axis=vec2(cos(a),sin(a)),crossAxis=vec2(-axis.y,axis.x);
   float along=dot(v,axis)*scale*(1.+fi*.48);
   float across=dot(v,crossAxis)*scale*.48;
   float phase=along+1.6*sin(across+fi*2.3)+fi*2.71;
   vec2 dp=(axis*(1.+fi*.48)+crossAxis*.768*cos(across+fi*2.3))*scale;
   float amp=(i==0?14.:i==1?8.:i==2?3.5:1.5)*amount*stiffness;
   float profile=sin(phase),slope=cos(phase);
   if(uWrinkleStyle>.5&&uWrinkleStyle<1.5){
     // Crumpled ridges: narrow crests with broader depressions.
     float c=cos(phase);profile=exp(-5.*(1.-c));slope=-5.*sin(phase)*profile;
     amp*=1.3;
   }else if(uWrinkleStyle>1.5){
     float d=sin(phase*.5);profile=exp(-32.*d*d);slope=-32.*d*cos(phase*.5)*profile;
     amp*=.7;
   }
   z+=profile*amp;grad+=slope*dp*amp;
 }
 // Inverse rotation returns slopes in the canvas coordinate frame.
 return vec3(mat2(cs,-sn,sn,cs)*grad,z);
}

vec3 shadeFabric(vec2 p,vec3 macroNormal,vec3 L,vec3 imageColor,float hasImage,float pool,float shadow){
 vec2 uv=p/max(48.,uWeaveScale*192.);
 vec4 albedo=texture2D(uFabricColor,uv),detail=texture2D(uFabricDetail,uv);
 vec3 normal=normalize(macroNormal+vec3((detail.rg-.5)*1.3,0.));
 float diffuse=max(dot(normal,L),0.);
 vec3 halfVector=normalize(L+vec3(0.,0.,1.));
 float rough=detail.b,gloss=mix(90.,9.,rough);
 float spec=pow(max(dot(normal,halfVector),0.),gloss)*(1.-rough)*.35;
 vec3 pigment=albedo.rgb;
 if(hasImage>.5){
   // Printed cloth retains yarn contrast without replacing the photograph's hue.
   float yarnLuma=dot(albedo.rgb,vec3(.3,.59,.11));
   float mean=uCloth<1.5?.66:uCloth<2.5?.78:uCloth<3.5?.24:uCloth<4.5?.78:.13;
   pigment=imageColor*clamp(yarnLuma/max(mean,.08),.55,1.35);
 }
 if(uCloth>3.5&&uCloth<4.5){
   // Satin's long floats produce a highlight stretched along the yarn direction.
   float tangent=dot(halfVector,normalize(vec3(1.,0.,-macroNormal.x)));
   spec=pow(max(0.,1.-tangent*tangent),22.)*pow(max(dot(normal,halfVector),0.),5.)*.48;
 }else if(uCloth>4.5&&uCloth<5.5){
   // Cut pile is dark face-on with soft grazing sheen and directional nap.
   float grazing=pow(1.-max(dot(normal,halfVector),0.),2.);
   float nap=.85+.15*vn(p*vec2(.025,.09));
   pigment*=nap*.83;spec=grazing*.75+.045*pow(diffuse,3.);
 }
 vec3 result=pigment*(.40+diffuse*.72)*(0.78+pool*.22)*(1.-shadow*.3)+vec3(1.,.97,.91)*spec;
 if(uCloth>5.5)result=mix(hasImage>.5?imageColor*.78:vec3(.11,.105,.10),result,albedo.a);
 return result;
}
