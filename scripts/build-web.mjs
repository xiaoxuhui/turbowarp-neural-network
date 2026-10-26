import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const Packager=require('@turbowarp/packager');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const config=JSON.parse(await fs.readFile(path.join(root,'web/config.json'),'utf8'));
const input=await fs.readFile(path.join(root,config.project));
const before=hash(input);
const loaded=await Packager.loadProject(input);
const packager=new Packager.Packager();
packager.project=loaded;
packager.options.target='html';
packager.options.autoplay=true;
packager.options.username='player';
packager.options.cloudVariables.mode='none';
packager.options.highQualityPen=true;
packager.options.appearance.background='#f4f5fb';
packager.options.appearance.foreground='#17253f';
packager.options.app.windowTitle=config.title;
packager.options.loadingScreen.text='正在加载'+config.title+'…';
for(const key of ['css','js']){
  try{packager.options.custom[key]=await fs.readFile(path.join(root,'web/adapter.'+key),'utf8');}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
packager.options.custom.js='window.__hallConfig='+JSON.stringify(config)+';\n'+await fs.readFile(path.join(root,'web/state.cjs'),'utf8')+'\n'+packager.options.custom.js;
const result=await packager.package();
if(result.type!=='text/html')throw Error('Expected self-contained HTML');
if(hash(await fs.readFile(path.join(root,config.project)))!==before)throw Error('Original SB3 changed during packaging');
const html=Buffer.from(result.data).toString('utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'">`);
result.data=Buffer.from(html);
const output=path.join(root,'web-dist');
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'index.html'),result.data);
await fs.copyFile(path.join(root,'LICENSE'),path.join(output,'LICENSE'));
const packageRoot=path.dirname(require.resolve('@turbowarp/packager/package.json'));
await fs.copyFile(path.join(packageRoot,'LICENSE'),path.join(output,'MPL-2.0.txt'));
await fs.copyFile(path.join(packageRoot,'dist/scaffolding/scaffolding-min.js.LICENSE.txt'),path.join(output,'scaffolding-min.js.LICENSE.txt'));
await fs.writeFile(path.join(output,'THIRD_PARTY_NOTICES.md'),`# Third-party runtime\n\nThis page packages the existing Scratch project with TurboWarp Packager 3.14.0. The project's own code is MIT; the bundled third-party runtime retains its own notices and licenses.\n\n- TurboWarp Packager and scaffolding: https://github.com/TurboWarp/packager ; Mozilla Public License 2.0, included as MPL-2.0.txt.\n- Scratch and renderer dependencies: original notices remain embedded in index.html and are reproduced in scaffolding-min.js.LICENSE.txt.\n- Exact package source: https://registry.npmjs.org/@turbowarp/packager/-/packager-3.14.0.tgz\n`);
const provenance={schemaVersion:1,id:config.id,title:config.title,version:config.version,
  sourceProject:config.project,sourceProjectSha256:before,
  sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  packagerVersion:require('@turbowarp/packager/package.json').version,
  entryPage:'index.html',bytes:result.data.length,sha256:hash(result.data)};
await fs.writeFile(path.join(output,'build-info.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify(provenance,null,2));
