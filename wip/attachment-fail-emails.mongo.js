conn = new Mongo();
db = conn.getDB("dmarc-analyzer");

cursor = db.emails.find();

while (cursor.hasNext()) {
	email = cursor.next();

	cursor2 = db.aggregatereports.find({gmailId: email.gmailId});

	if (!cursor2.hasNext()) {
		printjson(email);
	}
}
