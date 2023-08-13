{
	"__id": "123",
	"active": true,
	"enabled": true,
	"code": "tmp",
	"date": "2023-08-13T16:24:08.509Z",
	"name": "Temp User",
	"remark": "\nquery AccountsAndCases {\n  uiapi {\n    query {\n      Account {\n        edges {\n          node {\n            Name { value }\n            Industry { value }\n          }\n        }\n      }\n      Case(where: { AccountId: { inq: { Account: {\n        and: [\n          { Name: { like: \"United%\" } },\n          { Industry: { eq: \"Energy\" } }\n        ]},\n          ApiName:\"Id\" } } }) {\n        edges {\n          node {\n            AccountId { value }\n            Priority { value }\n            Subject { value }\n          }\n        }\n      }\n    }\n  }\n}\n                "
}