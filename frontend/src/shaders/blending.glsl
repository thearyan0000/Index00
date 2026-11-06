// W3C compositing equations, plus the Photoshop arithmetic/contrast modes.
// b is the base cloth/image; s is the thread layer. Coverage is applied once.
float blendLum(vec3 c){return dot(c,vec3(.3,.59,.11));}
float blendSat(vec3 c){return max(max(c.r,c.g),c.b)-min(min(c.r,c.g),c.b);}
vec3 clipBlendColor(vec3 c){
 float l=blendLum(c),n=min(min(c.r,c.g),c.b),x=max(max(c.r,c.g),c.b);
 if(n<0.)c=l+(c-l)*l/max(l-n,.000001);
 if(x>1.)c=l+(c-l)*(1.-l)/max(x-l,.000001);
 return clamp(c,0.,1.);
}
vec3 setBlendLum(vec3 c,float l){return clipBlendColor(c+vec3(l-blendLum(c)));}
vec3 setBlendSat(vec3 c,float s){float n=min(min(c.r,c.g),c.b),d=blendSat(c);return d>.000001?(c-vec3(n))*s/d:vec3(0.);}
float burnChannel(float b,float s){if(b>=1.)return 1.;if(s<=0.)return 0.;return 1.-min(1.,(1.-b)/s);}
float dodgeChannel(float b,float s){if(b<=0.)return 0.;if(s>=1.)return 1.;return min(1.,b/(1.-s));}
vec3 blendBurn(vec3 b,vec3 s){return vec3(burnChannel(b.r,s.r),burnChannel(b.g,s.g),burnChannel(b.b,s.b));}
vec3 blendDodge(vec3 b,vec3 s){return vec3(dodgeChannel(b.r,s.r),dodgeChannel(b.g,s.g),dodgeChannel(b.b,s.b));}
vec3 hardLight(vec3 b,vec3 s){return mix(2.*b*s,1.-2.*(1.-b)*(1.-s),step(vec3(.5),s));}
vec3 blendRGB(vec3 b,vec3 s,float mode){
 b=clamp(b,0.,1.);s=clamp(s,0.,1.);
 if(mode<1.5)return s;
 if(mode<2.5)return min(b,s);
 if(mode<3.5)return b*s;
 if(mode<4.5)return blendBurn(b,s);
 if(mode<5.5)return max(vec3(0.),b+s-1.);
 if(mode<6.5)return dot(b,vec3(1.))<=dot(s,vec3(1.))?b:s;
 if(mode<7.5)return max(b,s);
 if(mode<8.5)return 1.-(1.-b)*(1.-s);
 if(mode<9.5)return blendDodge(b,s);
 if(mode<10.5)return min(vec3(1.),b+s);
 if(mode<11.5)return dot(b,vec3(1.))>=dot(s,vec3(1.))?b:s;
 if(mode<12.5)return hardLight(s,b);
 if(mode<13.5){vec3 d=mix(((16.*b-12.)*b+4.)*b,sqrt(b),step(vec3(.25),b));return mix(b-(1.-2.*s)*b*(1.-b),b+(2.*s-1.)*(d-b),step(vec3(.5),s));}
 if(mode<14.5)return hardLight(b,s);
 if(mode<15.5)return mix(blendBurn(b,2.*s),blendDodge(b,2.*s-1.),step(vec3(.5),s));
 if(mode<16.5)return clamp(b+2.*s-1.,0.,1.);
 if(mode<17.5)return mix(min(b,2.*s),max(b,2.*s-1.),step(vec3(.5),s));
 if(mode<18.5)return step(vec3(1.),b+s);
 if(mode<19.5)return abs(b-s);
 if(mode<20.5)return b+s-2.*b*s;
 if(mode<21.5)return max(vec3(0.),b-s);
 if(mode<22.5)return min(vec3(1.),b/max(s,vec3(.000001)));
 if(mode<23.5)return setBlendLum(setBlendSat(s,blendSat(b)),blendLum(b));
 if(mode<24.5)return setBlendLum(setBlendSat(b,blendSat(s)),blendLum(b));
 if(mode<25.5)return setBlendLum(s,blendLum(b));
 return setBlendLum(b,blendLum(s));
}
