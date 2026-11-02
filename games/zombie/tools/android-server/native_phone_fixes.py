"""Reviewed ARM64 feature fixes for the pinned reference client."""
import struct
import hashlib

def branch(source,target):
    delta=target-source
    if delta%4 or not -(1<<27)<=delta<(1<<27):raise ValueError('ARM64 branch range')
    return struct.pack('<I',0x14000000|((delta//4)&0x3ffffff))

def patch_native(raw):
    out=bytearray(raw);proof=[]
    # OnClickRefreshBtn -> the existing native refresh request callback (AdType=4).
    # The backend still validates an active battle and returns CSReRandLearnedSkillRes.
    start=0x16A683C
    if out[start:start+4]!=bytes.fromhex('ffc300d1'):raise ValueError('Unexpected battle refresh entry')
    code=bytes.fromhex('81008052e2031faa')+branch(start+8,0x16A6F5C)
    out[start:start+len(code)]=code;proof.append('Battle skill refresh uses direct native request; no daily ad quota')
    # Quick chooser already contains a free request branch. Use it every time.
    start=0x16AAB80
    if out[start:start+4]!=bytes.fromhex('a8020034'):raise ValueError('Unexpected quick refresh quota branch')
    out[start:start+4]=bytes.fromhex('1f2003d5');proof.append('Quick battle refresh always uses free request branch')
    start=0x16A7928
    if out[start:start+4]!=bytes.fromhex('01010054'):raise ValueError('Unexpected refresh visibility limit branch')
    out[start:start+4]=branch(start,0x16A7948);proof.append('Keep native refresh button visible after the source one-refresh limit')
    # Personal server: the native ad-completion protocol is still used, but no
    # third-party ad SDK is invoked. All rewards remain server-side grants.
    start=0x13C0A6C
    if out[start:start+4]!=bytes.fromhex('ff0302d1'):raise ValueError('Unexpected ad entry')
    code=bytes.fromhex('1fa000391fa40039e2031f2ae3031faae4031faa')+branch(start+20,0x13C263C)
    out[start:start+len(code)]=code;proof.append('Personal free ad actions use typed native completion requests, without SDK playback')
    for start,label in [(0x173676C,'World boss'),(0x13FE0D8,'Maze')]:
        if out[start:start+4]!=bytes.fromhex('f553bea9'):raise ValueError('Unexpected activity time check')
        out[start:start+8]=bytes.fromhex('20008052c0035fd6');proof.append(label+' entry is always open')
    # The hall and maze page independently check daily/weekly windows. Opening
    # only MazeDataMgr still leaves the real hall button at "maze resting".
    for start,label in [(0x162CBD8,'Hall daily window'),(0x162AC1C,'Hall weekly window'),(0x165CA28,'Maze page weekly window')]:
        if out[start:start+4]!=bytes.fromhex('f553bea9'):raise ValueError('Unexpected '+label+' entry')
        out[start:start+8]=bytes.fromhex('20008052c0035fd6');proof.append(label+' is always open')
    # Use the client's existing pause-aware 1x/fast toggle. Remove clearance and
    # mode checks, and pin its fast factor to exactly 1.5, independent of cards.
    for start,expected in [(0x137BE04,'084440f9'),(0x137BE34,'f553bea9')]:
        if out[start:start+4]!=bytes.fromhex(expected):raise ValueError('Unexpected battle speed eligibility entry')
        out[start:start+8]=bytes.fromhex('20008052c0035fd6');proof.append('Battle speed eligibility enabled at '+hex(start))
    start=0x158B9A4
    if out[start:start+4]!=bytes.fromhex('3b1af997'):raise ValueError('Unexpected battle speed factor lookup')
    out[start:start+4]=bytes.fromhex('00102f1e');proof.append('Fast toggle factor is exactly 1.5; native pause handling retained')
    # This local server grants advanced skins for free. Let the real unlock
    # request reach it instead of stopping at the client's five-predecessor UI.
    start=0x16B6040
    if out[start:start+4]!=bytes.fromhex('61010054'):raise ValueError('Unexpected advanced skin prerequisite branch')
    out[start:start+4]=bytes.fromhex('1f2003d5');proof.append('Advanced outfit/core activation delegates to the personal server without UI prerequisites')
    # The bundled catalog has 48 outfits and 48 cores, while this protocol class
    # allocates only 32 entries. Expand allocation, initialization and both wire
    # bounds together; changing just the comparison leaves an undersized array.
    capacity=[(0x185D260,'01048052','01108052'),
              (0x185D2D8,'3f8300f1','3f0302f1'),
              (0x185D35C,'1f810071','1f010271'),
              (0x185D3B4,'1f810071','1f010271'),
              (0x185D484,'1f810071','1f010271')]
    for start,expected,replacement in capacity:
        if out[start:start+4]!=bytes.fromhex(expected):raise ValueError('Unexpected skin capacity instruction '+hex(start))
        out[start:start+4]=bytes.fromhex(replacement)
    proof.append('Skin ownership protocol capacity expanded consistently from 32 to 128')
    # Free advanced unlocks do not require owning every prerequisite. The source
    # red-dot check dereferences missing prerequisite ownership and aborts the
    # entire role-data UI refresh. Missing data means minimum level zero.
    for start,expected in [(0x14A0000,'400500b4'),(0x14A0048,'000300b4')]:
        if out[start:start+4]!=bytes.fromhex(expected):raise ValueError('Unexpected colorful prerequisite null guard')
        out[start:start+4]=struct.pack('<I',0xb4000000|(((0x14A008C-start)//4)<<5))
    proof.append('Missing colorful prerequisites return level zero instead of interrupting role UI refresh')
    # GemComposeUI already builds the result ItemData list but merely closes it.
    # Compact its List.Add fast/slow sequence, reuse the freed bytes for a call
    # to the existing CommonUIController reward popup, then retain native Close.
    start=0x15ED5F4;end=0x15ED654
    if hashlib.sha256(out[start:end]).hexdigest()!='80401e6ee4de126f85fa16ba23542ad05049a1dba8c8566c7348eddbcf8d151b':raise ValueError('Unexpected gem result list builder')
    def call(source,target):return struct.pack('<I',int.from_bytes(branch(source,target),'little')|0x80000000)
    out[start:end]=bytes.fromhex('1f2003d5')*((end-start)//4)
    compact=bytes.fromhex('e00315aae10316aa220340f9480040f900013fd6')+branch(start+20,end)
    out[start:start+len(compact)]=compact
    helper=0x15ED610
    code=bytes.fromhex('e0031faae10315aae2031f2ae3031f2a24008052e5031faa')+call(helper+24,0x15B2B74)+bytes.fromhex('e00313aa')+branch(helper+32,0x15ED668)
    out[helper:helper+len(code)]=code
    if out[0x15ED664:0x15ED668]!=bytes.fromhex('e00313aa'):raise ValueError('Unexpected gem result epilogue')
    out[0x15ED664:0x15ED668]=branch(0x15ED664,helper)
    proof.append('Gem composition shows the native item reward popup before closing its chooser')
    return bytes(out),proof
