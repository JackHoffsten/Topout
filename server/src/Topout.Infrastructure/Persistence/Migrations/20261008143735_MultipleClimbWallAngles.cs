using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MultipleClimbWallAngles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "WallAngles",
                table: "ClimbLogs",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]
            );
            migrationBuilder.Sql(
                """
                UPDATE "ClimbLogs" SET "WallAngles" = ARRAY["WallAngle"]
                WHERE "WallAngle" IS NOT NULL;
                """
            );
            migrationBuilder.DropColumn(name: "WallAngle", table: "ClimbLogs");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM "ClimbLogs" WHERE cardinality("WallAngles") > 1) THEN
                        RAISE EXCEPTION 'Cannot downgrade climbs with multiple wall angles.';
                    END IF;
                END $$;
                """
            );
            migrationBuilder.AddColumn<string>(
                name: "WallAngle",
                table: "ClimbLogs",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true
            );
            migrationBuilder.Sql("""UPDATE "ClimbLogs" SET "WallAngle" = "WallAngles"[1];""");
            migrationBuilder.DropColumn(name: "WallAngles", table: "ClimbLogs");
        }
    }
}
