import app = require("teem");
import Documento = require("../../models/documento");
import Usuario = require("../../models/usuario");

class DocumentoApiRoute {
  public static async listar(req: app.Request, res: app.Response): Promise<void> {
		const u = await Usuario.cookie(req, res, true);
		if (!u)
			return;

    const lista = await Documento.listar();
    res.json(lista);
  }

  public static async listarMeus(req: app.Request, res: app.Response): Promise<void> {
		const u = await Usuario.cookie(req, res);
		if (!u)
			return;

    const lista = await Documento.listarMeus(u.id);
    res.json(lista);
  }

  @app.http.post()
  public static async criar(req: app.Request, res: app.Response) {

  }

  @app.http.post()
  public static async editar(req: app.Request, res: app.Response): Promise<void> {
    const id = parseInt(req.params.id);
    const doc = req.body as Documento;
    doc.id = id;
    const erro = await Documento.editar(doc);
    if (erro) {
      res.status(400).json({ erro });
      return;
    }
    res.json(doc);
  }

  @app.http.delete()
  public static async excluir(req: app.Request, res: app.Response): Promise<void> {
    const id = parseInt(req.params.id);
    const erro = await Documento.excluir(id);
    if (erro) {
      res.status(400).json({ erro });
      return;
    }
    res.json({ sucesso: true });
  }
}

export = DocumentoApiRoute;
