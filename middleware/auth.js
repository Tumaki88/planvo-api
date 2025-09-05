import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET || "secret";

export function auth(req, res, next) {
    const header = req.headers["authorization"];
    if (!header) return res.status(401).json({ error: "No token" });
    const token = header.split(" ")[1];
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(403).json({ error: "Invalid token" });
    }
}
