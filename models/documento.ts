import app = require("teem");
import DataUtil = require("../utils/dataUtil");
import appsettings = require("../appsettings");
import { randomBytes } from "crypto";
import GeradorHash = require("../utils/geradorHash");
import intToHex = require("../utils/intToHex");
import Perfil = require("../enums/perfil");
import Validacao = require("../utils/validacao");


interface Documento {
  id: number;
  nome: string;
  nomecurto: string;
  criacao: string;
}

class Documento {
  public static async listar(): Promise<Documento[]> {
    let lista: Documento[] = null;

    await app.sql.connect(async (sql) => {
      lista = await sql.query("select id, nome, nomecurto, date_format(criacao, '%d/%m/%Y') criacao from documento order by nome asc") as Documento[];
    });

    return (lista || []);
  }

  public static async listarMeus(idusuario: number): Promise<Documento[]> {
    let lista: Documento[] = null;

    await app.sql.connect(async (sql) => {
      lista = await sql.query("select id, nome, nomecurto, date_format(criacao, '%d/%m/%Y') criacao from documento order by nome asc") as Documento[];
    });

    return (lista || []);
  }

  public static async obter(id: number): Promise<Documento> {
    let lista: Documento[] = null;

    await app.sql.connect(async (sql) => {
      lista = await sql.query("select id, nome, nomecurto, date_format(criacao, '%d/%m/%Y') criacao from documento where id = ?", [id]) as Documento[];
    });

    return ((lista && lista[0]) || null);
  }

  public static async criar(documento: Documento): Promise<string> {
    let res: string;

    if (!documento.nome || !(documento.nome = documento.nome.normalize().trim()) || documento.nome.length > 100) {
      return "Nome inválido";
    }

    if (!documento.nomecurto || !(documento.nomecurto = documento.nomecurto.normalize().trim()) || documento.nomecurto.length > 50) {
      return "Nome curto inválido";
    }

    await app.sql.connect(async (sql) => {
      try {
        await sql.query("insert into documento (nome, nomecurto, criacao) values (?, ?, now())", [documento.nome, documento.nomecurto]);
      } catch (e) {
        if (e.code) {
          switch (e.code) {
            case "ER_DUP_ENTRY":
              if (e.message.includes("nome")) {
                res = `O nome ${documento.nome} já está em uso`;
              } else if (e.message.includes("nomecurto")) {
                res = `O nome curto ${documento.nomecurto} já está em uso`;
              } else {
                throw e;
              }
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

    if (!documento.id) {
      return "Id inválido";
    }

    if (!documento.nome || !(documento.nome = documento.nome.normalize().trim()) || documento.nome.length > 100) {
      return "Nome inválido";
    }

    if (!documento.nomecurto || !(documento.nomecurto = documento.nomecurto.normalize().trim()) || documento.nomecurto.length > 50) {
      return "Nome curto inválido";
    }

    await app.sql.connect(async (sql) => {
      await sql.query("update documento set nome = ?, nomecurto = ? where id = ?", [documento.nome, documento.nomecurto, documento.id]);

      return (sql.affectedRows ? null : "Documento não encontrado");
    });
  }

  public static async excluir(id: number): Promise<string> {
    try {
      await app.sql.connect(async (sql) => {
        const affectedRows = await sql.query("delete from documento where id = ?", [id]);
  
        return affectedRows ? null : "Documento não encontrado";
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      return "Erro ao excluir documento";
    }
  }
  
}

export = Documento;
