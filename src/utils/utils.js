export const updateURL = (params) => {
  const currentParams = getParams();

  for(let param in params) {
    currentParams[param] = params[param];
  }  

  const paramsStr = paramsToString(currentParams);
  
  if (history.pushState) {
      const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      const newUrl = `${baseUrl}${paramsStr}`;
      history.pushState(null, null, newUrl);
  }
  else {
      console.warn('History API не поддерживается');
  }
}

export const paramsToString = (params, allowed = []) => {
  const arFullParams = [];
  for(let param in params) {
    if (allowed.length && !allowed.includes(param) || !params[param]) {
      continue;
    }

    arFullParams.push(`${param}=${params[param]}`);
  }

  return arFullParams.length ? `?${arFullParams.join('&')}` : '';
}

export const getParams = () => {
  const result = {};

  getParamsStr().split('&').forEach(el => {
    const arParam = el.split('=');
    
    result[arParam[0]] = arParam[1];
  })

  return result;
} 

export const getParamsStr = () => {
  return window.location.search.slice(1);
}

export const translate = async (str) => {
  const result = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&hl=ru&dt=t&dt=bd&dj=1&source=icon&tk=835045.835045&q=${encodeURI(str)}`);
  return result.json();
}