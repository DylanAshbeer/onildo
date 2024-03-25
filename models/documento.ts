import app = require("teem");
import { randomBytes } from "crypto";
import appsettings = require("../appsettings");
import DataUtil = require("../utils/dataUtil");
import GeradorHash = require("../utils/geradorHash");
import intToHex = require("../utils/intToHex");
import Perfil = require("../enums/perfil");
import Validacao = require("../utils/validacao");

interface documento {
	id: number;
	nome: string;
	nomecurto: string;
	criacao: string;

	// Utilizados apenas através do cookie
	admin: boolean;
}

class documento {
	private static readonly IdAdmin = 1;

	public static async cookie(req: app.Request, res: app.Response = null, admin: boolean = false): Promise<Documento> {
		let cookieStr = req.cookies[appsettings.cookie] as string;
		if (!cookieStr || cookieStr.length !== 48) {
			if (res) {
				res.statusCode = 403;
				res.json("Não permitido");
			}
			return null;
		} else {
			let id = parseInt(cookieStr.substr(0, 8), 16) ^ appsettings.documentoHashId;
			let documento: Documento = null;

			await app.sql.connect(async (sql) => {
				let rows = await sql.query("select id, nome, nomecurto from documento where id = ?", [id]);
				let row: any;

				if (!rows || !rows.length || !(row = rows[0]))
					return;

				let token = cookieStr.substring(16);

				if (!row.token || token !== (row.token as string))
					return;

				documento = new Documento();
				documento.id = id;
				documento.nome = row.nome as string;
				documento.nomecurto = row.nome as string;
				documento.admin = (documento.idperfil === Perfil.Administrador);
			});

			if (admin && documento && documento.idperfil !== Perfil.Administrador)
				documento = null;
			if (!documento && res) {
				res.statusCode = 403;
				res.json("Não permitido");
			}
			return documento;
		}
	}

	private static gerarTokenCookie(id: number): [string, string] {
		let idStr = intToHex(id ^ appsettings.documentoHashId);
		let idExtra = intToHex(0);
		let token = randomBytes(16).toString("hex");
		let cookieStr = idStr + idExtra + token;
		return [token, cookieStr];
	}

	public static async efetuarLogin(email: string, senha: string, res: app.Response): Promise<[string, Documento]> {
		if (!email || !senha)
			return ["Usuário ou senha inválidos", null];

		return await app.sql.connect(async (sql) => {
			email = email.normalize().trim().toLowerCase();

			const documentos: Documento[] = await sql.query("select id, nome, idperfil, senha from documento where email = ? and exclusao is null", [email]);
			let documento: Documento;

			if (!documentos || !documentos.length || !(documento = documentos[0]) || !(await GeradorHash.validarSenha(senha.normalize(), documento.senha as string)))
				return ["Usuário ou senha inválidos", null];

			let [token, cookieStr] = Documento.gerarTokenCookie(documento.id);

			await sql.query("update documento set token = ? where id = ?", [token, documento.id]);

			documento.admin = (documento.idperfil === Perfil.Administrador);

			res.cookie(appsettings.cookie, cookieStr, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, path: "/", secure: appsettings.cookieSecure });

			return [null, documento];
		});
	}

	public static async efetuarLogout(documento: Documento, res: app.Response): Promise<void> {
		await app.sql.connect(async (sql) => {
			await sql.query("update documento set token = null where id = ?", [documento.id]);

			res.cookie(appsettings.cookie, "", { expires: new Date(0), httpOnly: true, path: "/", secure: appsettings.cookieSecure });
		});
	}

	public static async alterarPerfil(documento: Documento, res: app.Response, nome: string, senhaAtual: string, novaSenha: string): Promise<string> {
		nome = (nome || "").normalize().trim();
		if (nome.length < 3 || nome.length > 100)
			return "Nome inválido";

		if (!!senhaAtual !== !!novaSenha || (novaSenha && (novaSenha.length < 6 || novaSenha.length > 20)))
			return "Senha inválida";

		let r: string = null;

		await app.sql.connect(async (sql) => {
			if (senhaAtual) {
				let hash = await sql.scalar("select senha from documento where id = ?", [documento.id]) as string;
				if (!await GeradorHash.validarSenha(senhaAtual.normalize(), hash)) {
					r = "Senha atual não confere";
					return;
				}

				hash = await GeradorHash.criarHash(novaSenha.normalize());

				let [token, cookieStr] = Documento.gerarTokenCookie(documento.id);

				await sql.query("update documento set nome = ?, senha = ?, token = ? where id = ?", [nome, hash, token, documento.id]);

				res.cookie(appsettings.cookie, cookieStr, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, path: "/", secure: appsettings.cookieSecure });
			} else {
				await sql.query("update documento set nome = ? where id = ?", [nome, documento.id]);
			}
		});

		return r;
	}

	private static validar(documento: Documento, criacao: boolean): string {
		if (!documento)
			return "Usuário inválido";

		documento.id = parseInt(documento.id as any);

		if (criacao) {
			// Limita o e-mail a 85 caracteres para deixar 15 sobrando, para tentar evitar perda de dados durante a concatenação da exclusão
			if (!documento.email || !Validacao.isEmail(documento.email = documento.email.normalize().trim().toLowerCase()) || documento.email.length > 85)
				return "E-mail inválido";
		} else {
			if (isNaN(documento.id))
				return "Id inválido";
		}

		if (!documento.nome || !(documento.nome = documento.nome.normalize().trim()) || documento.nome.length > 100)
			return "Nome inválido";

		if (isNaN(documento.idperfil = parseInt(documento.idperfil as any) as Perfil))
			return "Perfil inválido";

		if (criacao) {
			if (!documento.senha || (documento.senha = documento.senha.normalize()).length < 6 || documento.senha.length > 20)
				return "Senha inválida";
		}

		return null;
	}

	public static async listar(): Promise<Documento[]> {
		let lista: Documento[] = null;

		await app.sql.connect(async (sql) => {
			lista = await sql.query("select u.id, u.email, u.nome, p.nome perfil, date_format(u.criacao, '%d/%m/%Y') criacao from documento u inner join perfil p on p.id = u.idperfil where u.exclusao is null order by u.email asc") as Documento[];
		});

		return (lista || []);
	}

	public static async obter(id: number): Promise<Documento> {
		let lista: Documento[] = null;

		await app.sql.connect(async (sql) => {
			lista = await sql.query("select id, email, nome, idperfil, date_format(criacao, '%d/%m/%Y') criacao from documento where id = ?", [id]) as Documento[];
		});

		return ((lista && lista[0]) || null);
	}

	public static async criar(documento: Documento): Promise<string> {
		let res: string;
		if ((res = Documento.validar(documento, true)))
			return res;

		await app.sql.connect(async (sql) => {
			try {
				await sql.query("insert into documento (email, nome, idperfil, senha, criacao) values (?, ?, ?, ?, now())", [documento.email, documento.nome, documento.idperfil, await GeradorHash.criarHash(documento.senha)]);
			} catch (e) {
				if (e.code) {
					switch (e.code) {
						case "ER_DUP_ENTRY":
							res = `O e-mail ${documento.email} já está em uso`;
							break;
						case "ER_NO_REFERENCED_ROW":
						case "ER_NO_REFERENCED_ROW_2":
							res = "Perfil não encontrado";
							break;
						default:
							throw e;
					}
				} else {
					throw e;
				}
			}
		});

		return res;
	}

	public static async editar(documento: Documento): Promise<string> {
		let res: string;
		if ((res = Documento.validar(documento, false)))
			return res;

		if (documento.id === Documento.IdAdmin)
			return "Não é possível editar o usuário administrador principal";

		return await app.sql.connect(async (sql) => {
			await sql.query("update documento set nome = ?, idperfil = ? where id = ?", [documento.nome, documento.idperfil, documento.id]);

			return (sql.affectedRows ? null : "Usuário não encontrado");
		});
	}

	public static async excluir(id: number): Promise<string> {
		if (id === Documento.IdAdmin)
			return "Não é possível excluir o usuário administrador principal";

		return app.sql.connect(async (sql) => {
			const agora = DataUtil.horarioDeBrasiliaISOComHorario();

			// Utilizar substr(email, instr(email, ':') + 1) para remover o prefixo, caso precise desfazer a exclusão (caso
			// não exista o prefixo, instr() vai retornar 0, que, com o + 1, faz o substr() retornar a própria string inteira)
			await sql.query("update documento set email = concat('@', id, ':', email), token = null, exclusao = ? where id = ?", [agora, id]);

			return (sql.affectedRows ? null : "Usuário não encontrado");
		});
	}
}

export = Documento;
