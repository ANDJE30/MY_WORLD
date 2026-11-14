"""Met à jour le sommaire et les champs (LibreOffice/UNO), puis exporte en PDF et réenregistre le .docx.
Usage : python3 convert.py fichier1.docx [fichier2.docx ...]"""
import subprocess, sys, time, os, uno
from com.sun.star.beans import PropertyValue

def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p

proc = subprocess.Popen(['soffice', '--headless', '--invisible', '--nologo', '--norestore',
                         '--accept=socket,host=127.0.0.1,port=2002;urp;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ctx = None
for _ in range(60):
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        ctx = resolver.resolve('uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext'); break
    except Exception:
        time.sleep(0.5)
desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
try:
    for f in sys.argv[1:]:
        path = os.path.abspath(f); url = uno.systemPathToFileUrl(path)
        doc = desktop.loadComponentFromURL(url, '_blank', 0, (prop('Hidden', True),))
        for _ in range(2):  # deux passes : la pagination dépend du sommaire
            idx = doc.getDocumentIndexes()
            for i in range(idx.getCount()): idx.getByIndex(i).update()
            doc.getTextFields().refresh()
        doc.storeToURL(uno.systemPathToFileUrl(path[:-5] + '.pdf'), (prop('FilterName', 'writer_pdf_Export'),))
        doc.storeToURL(url, (prop('FilterName', 'MS Word 2007 XML'),))
        doc.close(True)
        print('OK', os.path.basename(path), '-> .pdf + sommaire à jour')
finally:
    try: desktop.terminate()
    except Exception: pass
    proc.wait(timeout=30)
